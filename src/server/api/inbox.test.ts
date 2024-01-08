import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'
import { APOrderedCollection } from 'activitypub-types'

interface TestContext {
  server: FastifyTypebox
  hasPermissionActorRequestStub: sinon.SinonStub
  mockStore: any
}

const test = anyTest as TestFn<TestContext>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()

  // Set up the mockStore
  t.context.mockStore = {
    forActor: sinon.stub().returns({
      inbox: {
        list: sinon.stub().resolves([]),
        add: sinon.stub().resolves(),
        remove: sinon.stub().resolves()
      }
    })
  }

  t.context.hasPermissionActorRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasPermissionActorRequest').resolves(true)
})

test.afterEach.always(async t => {
  await t.context.server?.close()
  t.context.hasPermissionActorRequestStub.restore()
})

// Test for GET /:actor/inbox
test.serial('GET /:actor/inbox - success', async t => {
  const actor = 'testActor'
  t.context.hasPermissionActorRequestStub.resolves(true)

  // Mock inbox collection
  const mockedCollection: APOrderedCollection = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'OrderedCollection',
    id: `/v1/${actor}/inbox`,
    orderedItems: []
  }
  t.context.mockStore.forActor(actor).inbox.list.resolves(mockedCollection.orderedItems)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/inbox`
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(JSON.parse(response.body), mockedCollection, 'returns the inbox collection')
})

test.serial('GET /:actor/inbox - not allowed', async t => {
  const actor = 'testActor'
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/inbox`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Test for POST /:actor/inbox
test.serial('POST /:actor/inbox - success', async t => {
  const actor = 'testActor'
  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    actor: 'https://example.com/user1',
    object: {
      type: 'Note',
      content: 'Test note',
      id: 'https://example.com/note1'
    },
    id: 'https://example.com/activity1'
  }

  t.context.hasPermissionActorRequestStub.resolves(true)

  // Mock external HTTP requests
  sinon.stub(ActivityPubSystem.prototype, 'verifySignedRequest').resolves('https://example.com/actor')
  sinon.stub(ActivityPubSystem.prototype, 'mentionToActor').resolves('https://example.com/user1')
  sinon.stub(ActivityPubSystem.prototype, 'ingestActivity').resolves()

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/inbox`,
    payload: activity,
    headers: { 'Content-Type': 'application/json' }
  })

  // Restore the stubs after the test
  sinon.restore()

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('POST /:actor/inbox - not allowed', async t => {
  const actor = 'testActor'
  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    actor: 'https://example.com/user1',
    object: {
      type: 'Note',
      content: 'Test note',
      id: 'https://example.com/note1'
    },
    id: 'https://example.com/activity1'
  }

  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/inbox`,
    payload: activity,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Test for DELETE /:actor/inbox/:id
test.serial('DELETE /:actor/inbox/:id - success', async t => {
  const actor = 'testActor'
  const id = 'testActivityId'

  t.context.hasPermissionActorRequestStub.resolves(true)

  // Stub the rejectActivity method
  sinon.stub(ActivityPubSystem.prototype, 'rejectActivity').resolves()

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/inbox/${id}`
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('DELETE /:actor/inbox/:id - not allowed', async t => {
  const actor = 'testActor'
  const id = 'testActivityId'

  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/inbox/${id}`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
