import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'

interface TestContext {
  server: FastifyTypebox
  hasPermissionActorRequestStub: sinon.SinonStub
  mockStore: any
}

const test = anyTest as TestFn<TestContext>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()

  // Set up the mockStore and other required stubs
  t.context.mockStore = {
    forActor: sinon.stub().returns({
      hooks: {
        setModerationQueued: sinon.stub().resolves(),
        getModerationQueued: sinon.stub().resolves(),
        deleteModerationQueued: sinon.stub().resolves(),
        setOnApproved: sinon.stub().resolves(),
        getOnApproved: sinon.stub().resolves(),
        deleteOnApproved: sinon.stub().resolves(),
        setOnRejected: sinon.stub().resolves(),
        getOnRejected: sinon.stub().resolves(),
        deleteOnRejected: sinon.stub().resolves()
      }
    })
  }

  t.context.hasPermissionActorRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasPermissionActorRequest').resolves(true)
  // Mock setting hooks for onapproved and onrejected
  t.context.mockStore.forActor('testActor').hooks.setOnApproved.resolves()
  t.context.mockStore.forActor('testActor').hooks.setOnRejected.resolves()

  // Set hooks before each test
  await t.context.server.inject({
    method: 'PUT',
    url: '/v1/testActor/hooks/onapproved',
    payload: onApprovedHookData,
    headers: { 'Content-Type': 'application/json' }
  })
  await t.context.server.inject({
    method: 'PUT',
    url: '/v1/testActor/hooks/onrejected',
    payload: onRejectedHookData,
    headers: { 'Content-Type': 'application/json' }
  })
})

test.afterEach.always(async t => {
  await t.context.server?.close()
  t.context.hasPermissionActorRequestStub.restore()
})

const moderationQueuedHookData = {
  url: 'https://example.com/moderationqueuedhook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}

const onApprovedHookData = {
  url: 'https://example.com/onapprovedhook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}

const onRejectedHookData = {
  url: 'https://example.com/onrejectedhook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}

// ModerationQueued success
test.serial('PUT /:actor/hooks/moderationqueued - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/moderationqueued`,
    payload: moderationQueuedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 200, 'Hook set successfully')
})

test.serial('GET /:actor/hooks/moderationqueued - not found', async t => {
  const actor = 'testActor'

  // Mock getModerationQueued to return null (hook not found)
  t.context.mockStore.forActor(actor).hooks.getModerationQueued.resolves(null)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/moderationqueued`
  })

  t.is(response.statusCode, 404, 'returns a status code of 404')
})

test.serial('DELETE /:actor/hooks/moderationqueued - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/moderationqueued`
  })

  t.is(response.statusCode, 200, 'Hook deleted successfully')
})

// OnApprovedHook success
test.serial('PUT /:actor/hooks/onapproved - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/onapproved`,
    payload: onApprovedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 200, 'Hook set successfully')
})

test.serial('GET /:actor/hooks/onapproved - success', async t => {
  const actor = 'testActor'

  // Ensure the mockStore returns the onApprovedHookData
  t.context.mockStore.forActor(actor).hooks.getOnApproved.resolves(onApprovedHookData)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/onapproved`
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(JSON.parse(response.body), onApprovedHookData, 'returns the expected hook data')
})

test.serial('DELETE /:actor/hooks/onapproved - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/onapproved`
  })

  t.is(response.statusCode, 200, 'Hook deleted successfully')
})

// OnRejectedHook success
test.serial('PUT /:actor/hooks/onrejected - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/onrejected`,
    payload: onRejectedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 200, 'Hook set successfully')
})

test.serial('GET /:actor/hooks/onrejected - success', async t => {
  const actor = 'testActor'

  // Ensure the mockStore returns the onRejectedHookData
  t.context.mockStore.forActor(actor).hooks.getOnRejected.resolves(onRejectedHookData)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/onrejected`
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(JSON.parse(response.body), onRejectedHookData, 'returns the expected hook data')
})

test.serial('DELETE /:actor/hooks/onrejected - success', async t => {
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/onrejected`
  })

  t.is(response.statusCode, 200, 'Hook deleted successfully')
})

// Negative cases for ModerationQueued Hook
test.serial('PUT /:actor/hooks/moderationqueued - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/moderationqueued`,
    payload: moderationQueuedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('GET /:actor/hooks/moderationqueued - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/moderationqueued`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/hooks/moderationqueued - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/moderationqueued`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Negative cases for OnApprovedHook
test.serial('PUT /:actor/hooks/onapproved - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/onapproved`,
    payload: onApprovedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('GET /:actor/hooks/onapproved - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/onapproved`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/hooks/onapproved - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/onapproved`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Negative cases for OnRejectedHook
test.serial('PUT /:actor/hooks/onrejected - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'PUT',
    url: `/v1/${actor}/hooks/onrejected`,
    payload: onRejectedHookData,
    headers: { 'Content-Type': 'application/json' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('GET /:actor/hooks/onrejected - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/hooks/onrejected`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/hooks/onrejected - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/hooks/onrejected`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
