import test from 'ava'
import sinon from 'sinon'
import fastify from 'fastify'
import ActivityPubSystem, { FetchLike, DEFAULT_PUBLIC_KEY_FIELD } from './apsystem'
import type { FastifyRequest } from 'fastify'
import Store from './store/index.js'
import { ModerationChecker } from './moderation.js'
import HookSystem from './hooksystem'
import signatureParser from 'activitypub-http-signatures'
import { MemoryLevel } from 'memory-level'
import { APActivity } from 'activitypub-types'

// Helper function to create a new Store instance
function newStore (): Store {
  return new Store(new MemoryLevel({ valueEncoding: 'json' }))
}

// Create some mock dependencies
const mockStore = {
  admins: { matches: () => {} },
  blocklist: { matches: () => {} },
  forActor: () => ({
    getInfo: () => {},
    inbox: { add: () => {}, get: () => {}, remove: () => {} },
    outbox: { add: () => {} },
    followers: { list: () => {}, add: () => {}, remove: () => {} }
  })
} as unknown as Store

const mockModCheck = new ModerationChecker(mockStore)
const mockFetch: FetchLike = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return new Response(JSON.stringify({}), { status: 200 })
}
const mockHooks = new HookSystem(mockStore, mockFetch)

const mockServer = fastify({ logger: true })

sinon.stub(mockServer, 'log').value({
  info: sinon.fake(),
  error: sinon.fake(),
  warn: sinon.fake()
})

const mockRequest = {
  url: 'http://example.com',
  method: 'GET',
  headers: {}
} as unknown as FastifyRequest

// Initialize the main class to test
const aps = new ActivityPubSystem('http://localhost', mockStore, mockModCheck, mockHooks, mockServer.log)

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

test('getActor uses signedFetch when fromActor is provided', async t => {
  const actorURL = 'http://remote.actor'
  const fromActor = 'http://local.actor'

  await t.notThrowsAsync(async () => {
    const actor = await aps.getActor(actorURL, fromActor)
    t.truthy(actor, 'Actor should be fetched successfully with signed request')
  }, 'getActor should use signedFetch when fromActor is provided')
})

test('getActor uses regular fetch when fromActor is not provided', async t => {
  const actorURL = 'http://remote.actor'

  await t.notThrowsAsync(async () => {
    const actor = await aps.getActor(actorURL)
    t.truthy(actor, 'Actor should be fetched successfully without signed request')
  }, 'getActor should use regular fetch when fromActor is not provided')
})

// Test for successful Webfinger fetch with fallback to Host-Meta
test('mentionToActor fetches from Webfinger and falls back to Host-Meta on 404', async t => {
  const mention = '@test@domain.com'
  const hostMetaXML = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" template="https://domain.com/.well-known/webfinge/{uri}"/>
</XRD>`

  // Create a single stub for the fetch method
  const fetchStub = sinon.stub(aps, 'fetch')

  // Configure responses for different URLs
  fetchStub
    .withArgs(sinon.match(/webfinger/))
    .returns(Promise.resolve(new Response(null, { status: 404 }))) // 404 for Webfinger

  fetchStub
    .withArgs(sinon.match(/host-meta/))
    .returns(Promise.resolve(new Response(hostMetaXML, { status: 200 }))) // Success for Host-Meta

  fetchStub
    .withArgs(sinon.match(/webfinge/))
    .returns(Promise.resolve(
      new Response(JSON.stringify({
        subject: 'acct:test@domain.com',
        links: [{ rel: 'self', href: 'http://actor.url' }]
      }), { status: 200 })
    )) // Success for the actual webmention URL

  const result = await aps.mentionToActor(mention)
  t.is(result, 'http://actor.url', 'should fetch from Webfinger and fallback to Host-Meta on 404')
})

test('ActivityPubSystem - List replies', async t => {
  const store = newStore()
  const hookSystem = new HookSystem(store, mockFetch)
  const aps = new ActivityPubSystem('http://localhost', store, mockModCheck, hookSystem, mockServer.log)

  const actorMention = '@user1@example.com'
  const inReplyTo = 'https://example.com/note2'
  // Sample data for the tests
  const activity: APActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    published: new Date().toISOString(),
    actor: 'https://example.com/user1',
    object: {
      type: 'Note',
      published: new Date().toISOString(),
      content: 'Hello world',
      id: 'https://example.com/note1',
      inReplyTo,
      attributedTo: 'https://example.com/user1'
    },
    id: 'https://example.com/activity1'
  }

  await store.forActor(actorMention).inbox.add(activity)

  await aps.approveActivity(actorMention, activity.id as string)

  const collection = await aps.repliesCollection(actorMention, inReplyTo)

  t.deepEqual(collection.items, [activity.object])
})

test('ActivityPubSystem - Undo activity', async t => {
  const store = newStore()
  const hookSystem = new HookSystem(store, mockFetch)
  const aps = new ActivityPubSystem('http://localhost', store, mockModCheck, hookSystem, mockServer.log)

  const actorMention = '@user1@example.com'
  const inReplyTo = 'https://example.com/note2'

  // Sample data for the tests
  const activity: APActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    published: new Date().toISOString(),
    actor: 'https://example.com/user1',
    object: {
      type: 'Note',
      published: new Date().toISOString(),
      content: 'Hello world',
      id: 'https://example.com/note1',
      inReplyTo,
      attributedTo: 'https://example.com/user1'
    },
    id: 'https://example.com/activity1'
  }

  const undoActivity: APActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Undo',
    actor: 'https://example.com/user1',
    object: {
      id: activity.id,
      type: activity.type
    },
    id: 'https://example.com/undo1'
  }

  await store.forActor(actorMention).inbox.add(activity)
  await aps.approveActivity(actorMention, activity.id as string)

  // Log to verify the activity is in the store
  const storedActivity = await store.forActor(actorMention).inbox.get(activity.id as string)
  console.log('Stored activity:', storedActivity)

  t.truthy(storedActivity, 'The activity is stored successfully')

  // Add Undo activity
  await store.forActor(actorMention).inbox.add(undoActivity)
  await aps.approveActivity(actorMention, undoActivity.id as string)

  const storedUndoActivity = await store.forActor(actorMention).inbox.get(undoActivity.id as string)
  console.log('Stored undo activity:', storedUndoActivity)

  t.truthy(storedUndoActivity, 'The undo activity is stored successfully')

  // Activity is undone
  const collection = await aps.repliesCollection(actorMention, inReplyTo)
  t.deepEqual(collection.items, [activity.object])
})

// After all tests, restore all sinon mocks
test.afterEach(() => {
  // Restore all sinon mocks
  sinon.restore()
})
