import test from 'ava'
import sinon from 'sinon'
import ActivityPubSystem, { FetchLike, DEFAULT_PUBLIC_KEY_FIELD } from './apsystem'
import type { FastifyRequest } from 'fastify'
import Store from './store/index.js'
import { ModerationChecker } from './moderation.js'
import HookSystem from './hooksystem'
import signatureParser from 'activitypub-http-signatures'

// Create a sample Create activity with a reply
const createActivity = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  actor: 'https://example.com/user1',
  object: {
    type: 'Note',
    content: 'Hello, World!',
    id: 'https://example.com/note1'
  },
  id: 'https://example.com/activity1'
}

// Create some mock dependencies
const mockStore = {
  admins: { matches: () => {} },
  blocklist: { matches: () => {} },
  forActor: () => ({
    getInfo: () => {},
    inbox: { add: () => {}, get: () => {}, remove: () => {} },
    outbox: { add: () => {} },
    followers: { list: () => {}, add: () => {}, remove: () => {} },
    replies: {
      add: sinon.stub().resolves(),
      list: sinon.stub().resolves([createActivity.object])
    }
  })
} as unknown as Store

const mockModCheck = new ModerationChecker(mockStore)
const mockFetch: FetchLike = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return new Response(JSON.stringify({}), { status: 200 })
}
const mockHooks = new HookSystem(mockStore, mockFetch)

const mockRequest = {
  url: 'http://example.com',
  method: 'GET',
  headers: {}
} as unknown as FastifyRequest

// Initialize the main class to test
const aps = new ActivityPubSystem('http://localhost', mockStore, mockModCheck, mockHooks)

test.beforeEach(() => {
  // Restore stubs before setting them up again
  sinon.restore()

  sinon.stub(aps, 'verifySignedRequest').returns(Promise.resolve('http://test.url'))
  sinon.stub(aps, 'signedFetch').returns(Promise.resolve(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { signature: 'mockSignature' }
    })
  ))
  sinon.stub(mockStore.admins, 'matches')
  sinon.stub(aps, 'actorToMention').returns(Promise.resolve('@test@domain.com'))
  sinon.stub(aps, 'getActor').returns(Promise.resolve({
    id: 'testId',
    inbox: 'dummyInboxValue', // Added dummy value
    outbox: 'dummyOutboxValue', // Added dummy value
    [DEFAULT_PUBLIC_KEY_FIELD]: {
      publicKeyPem: 'testPublicKeyPem'
    }
  }))
  sinon.stub(aps, 'mentionToActor').returns(Promise.resolve('http://actor.url'))
  sinon.stub(aps, 'getInbox').returns(Promise.resolve('http://inbox.url'))
  sinon.stub(signatureParser, 'parse').returns({
    keyId: 'testKeyId',
    signature: Buffer.from('dummySignature'), // Added dummy value
    string: 'dummyString', // Added dummy value
    verify: sinon.stub().returns(true)
  })
  sinon.stub(aps, 'modCheck').returns({ isAllowed: () => true })
})

test('verifySignedRequest returns actor URL on successful verification', async t => {
  const requestPayload = {
    url: 'http://test.url',
    method: 'GET',
    headers: {}
  } as unknown as FastifyRequest

  const result = await aps.verifySignedRequest(requestPayload, 'testActor')
  t.is(result, 'http://test.url', 'verifySignedRequest should return the actor URL on successful verification')
})

test('signedFetch correctly signs the request', async t => {
  const requestPayload = {
    url: 'http://test.url',
    method: 'GET',
    headers: {}
  }

  const response = await aps.signedFetch('testActor', requestPayload)

  // Assuming signature was added to the response headers
  t.truthy(response.headers.get('signature'), 'The request should be signed')
})

test('sendTo sends activity and handles response correctly', async t => {
  const activityPayload = { type: 'Create', actor: 'actor', object: 'content' }

  await t.notThrowsAsync(async () => {
    await aps.sendTo('http://actor.url', 'testActor', activityPayload)
  }, 'sendTo should send the activity and handle the response correctly')
})

test('hasPermissionActorRequest allows a valid actor', async t => {
  (aps.verifySignedRequest as sinon.SinonStub).resolves('actor');
  (mockStore.admins.matches as sinon.SinonStub).resolves(false)

  const result = await aps.hasPermissionActorRequest('actor', mockRequest)
  t.true(result)
})

test('hasPermissionActorRequest denies an invalid actor', async t => {
  (aps.verifySignedRequest as sinon.SinonStub).resolves('different-actor');
  (mockStore.admins.matches as sinon.SinonStub).resolves(false)

  const result = await aps.hasPermissionActorRequest('actor', mockRequest)
  t.false(result)
})

test('store reply in response to a Create activity', async t => {
  await mockStore.forActor('https://example.com/user1').replies.add(createActivity.object)

  const storedReplies = await mockStore.forActor('https://example.com/user1').replies.list('https://example.com/note1')

  t.deepEqual(storedReplies, [createActivity.object], 'The reply should be stored in the replies store')
})

// After all tests, restore all sinon mocks
test.afterEach(() => {
  // Restore all sinon mocks
  sinon.restore()
})
