import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'
import { APActivity } from 'activitypub-types'

interface TestContext {
  server: FastifyTypebox
  hasPermissionActorRequestStub: sinon.SinonStub
}

const test = anyTest as TestFn<TestContext>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()
  t.context.hasPermissionActorRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasPermissionActorRequest').resolves(true)
})

test.afterEach.always(async t => {
  await t.context.server?.close()
  t.context.hasPermissionActorRequestStub.restore()
})

// Test for POST /:actor/outbox
test.serial('POST /:actor/outbox - success', async t => {
  const actor = 'testActor'
  const activity: APActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    actor: `http://localhost:3000/v1/${actor}`,
    object: {
      type: 'Note',
      content: 'Hello world!'
    }
  }

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/outbox`,
    payload: activity,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const responseBody = JSON.parse(response.body)
  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(responseBody, { message: 'ok' }, 'returns success message')
})

test.serial('POST /:actor/outbox - not allowed', async t => {
  const actor = 'testActor'
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/outbox`,
    payload: {},
    headers: {
      'Content-Type': 'application/json'
    }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Test for GET /:actor/outbox/:id
test.serial('GET /:actor/outbox/:id - success', async t => {
  const actor = 'testActor'
  const itemId = 'testItemId'
  t.context.hasPermissionActorRequestStub.resolves(true)

  const activity: APActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    id: `http://localhost:3000/v1/${actor}/outbox/${itemId}`,
    actor: `http://localhost:3000/v1/${actor}`,
    object: {
      type: 'Note',
      content: 'Hello world!'
    }
  }

  sinon.stub(ActivityPubSystem.prototype, 'getOutboxItem').withArgs(actor, itemId).resolves(activity)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/outbox/${itemId}`
  })

  const responseBody = JSON.parse(response.body)
  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(responseBody, activity, 'returns the expected outbox item')
})

test.serial('GET /:actor/outbox/:id - not allowed', async t => {
  const actor = 'testActor'
  const itemId = 'testItemId'
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/outbox/${itemId}`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
