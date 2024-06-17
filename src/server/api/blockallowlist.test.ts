import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'

interface TestContext {
  server: FastifyTypebox
  hasAdminPermissionForRequestStub: sinon.SinonStub
  hasPermissionActorRequestStub: sinon.SinonStub
  mockStore: any
}

const test = anyTest as TestFn<TestContext>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()

  // Set up the mockStore
  t.context.mockStore = {
    blocklist: {
      list: sinon.stub(),
      add: sinon.stub().resolves(),
      remove: sinon.stub().resolves()
    },
    allowlist: {
      list: sinon.stub(),
      add: sinon.stub().resolves(),
      remove: sinon.stub().resolves()
    },
    forActor: sinon.stub().callsFake((actor) => ({
      blocklist: {
        list: sinon.stub().resolves([]),
        add: sinon.stub().resolves(),
        remove: sinon.stub().resolves()
      },
      allowlist: {
        list: sinon.stub().resolves([]),
        add: sinon.stub().resolves(),
        remove: sinon.stub().resolves()
      }
    }))
  }

  // Setup mock responses
  t.context.mockStore.blocklist.list.resolves(['blocked@example.com'])
  t.context.mockStore.allowlist.list.resolves(['allowed@example.com'])
  t.context.mockStore.forActor('testActor').blocklist.list.resolves(['user1@example.com', 'user2@example.com'])
  t.context.mockStore.forActor('testActor').allowlist.list.resolves(['user5@example.com', 'user6@example.com'])

  t.context.hasAdminPermissionForRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasAdminPermissionForRequest').resolves(true)
  t.context.hasPermissionActorRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasPermissionActorRequest').resolves(true)
})

test.afterEach.always(async t => {
  await t.context.server?.close()
  t.context.hasAdminPermissionForRequestStub.restore()
  t.context.hasPermissionActorRequestStub.restore()

  // Reset the mock store for blocklist and allowlist
  t.context.mockStore.blocklist.list.reset()
  t.context.mockStore.allowlist.list.reset()
})

// Global Blocklist Tests
test.serial('GET /blocklist - success', async t => {
  // Add a new account to blocklist
  await t.context.server.inject({
    method: 'POST',
    url: '/v1/blocklist',
    payload: 'blocked@example.com',
    headers: { 'Content-Type': 'text/plain' }
  })

  // Fetch the updated list of blocked accounts
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/blocklist'
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.is(response.body, 'blocked@example.com', 'returns the blocklist')
})

test.serial('POST /blocklist - success', async t => {
  const blocklistData = 'block@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/blocklist',
    payload: blocklistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('DELETE /blocklist - success', async t => {
  const blocklistData = 'unblock@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/blocklist',
    payload: blocklistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

// Global Allowlist Tests
test.serial('GET /allowlist - success', async t => {
  // Add a new account to allowlist
  await t.context.server.inject({
    method: 'POST',
    url: '/v1/allowlist',
    payload: 'allowed@example.com',
    headers: { 'Content-Type': 'text/plain' }
  })

  // Fetch the updated list of allowed accounts
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/allowlist'
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.is(response.body, 'allowed@example.com', 'returns the allowlist')
})

test.serial('POST /allowlist - success', async t => {
  const allowlistData = 'allow@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/allowlist',
    payload: allowlistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('DELETE /allowlist - success', async t => {
  const allowlistData = 'disallow@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/allowlist',
    payload: allowlistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

// Negative cases for Global Blocklist
test.serial('GET /v1/blocklist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/blocklist'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('POST /v1/blocklist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)
  const blocklistData = 'block@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/blocklist',
    payload: blocklistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /v1/blocklist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)
  const blocklistData = 'unblock@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/blocklist',
    payload: blocklistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Negative cases for Global Allowlist
test.serial('GET /v1/allowlist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/allowlist'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('POST /v1/allowlist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)
  const allowlistData = 'allow@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/allowlist',
    payload: allowlistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /v1/allowlist - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)
  const allowlistData = 'disallow@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/allowlist',
    payload: allowlistData,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Actor-specific Blocklist Test
// test.serial('GET /:actor/blocklist - success', async t => {
//   const actor = 'testActor'
//   const blockedAccounts = ['user1@example.com', 'user2@example.com']

//   // Ensure the mockStore returns the blocked accounts
//   t.context.mockStore.forActor(actor).blocklist.list.resolves(blockedAccounts)

//   const response = await t.context.server.inject({
//     method: 'GET',
//     url: `/v1/${actor}/blocklist`
//   })

//   console.log(response.statusCode, response.body)

//   t.is(response.statusCode, 200, 'returns a status code of 200')
//   t.deepEqual(response.body.split('\n'), blockedAccounts, 'returns the correct blocklist')
// })

test.serial('POST /:actor/blocklist - success', async t => {
  const actor = 'testActor'
  const accountsToAdd = ['user3@example.com', 'user4@example.com'].join('\n')

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/blocklist`,
    payload: accountsToAdd,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('DELETE /:actor/blocklist - success', async t => {
  const actor = 'testActor'
  const accountsToRemove = ['user3@example.com', 'user4@example.com'].join('\n')

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/blocklist`,
    payload: accountsToRemove,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

// Actor-specific Allowlist Tests
// test.serial('GET /:actor/allowlist - success', async t => {
//   const actor = 'testActor'
//   const allowedAccounts = ['user5@example.com', 'user6@example.com']

//   // Ensure the mockStore returns the allowed accounts
//   t.context.mockStore.forActor(actor).allowlist.list.resolves(allowedAccounts)

//   const response = await t.context.server.inject({
//     method: 'GET',
//     url: `/v1/${actor}/allowlist`
//   })

//   console.log(response.statusCode, response.body)

//   t.is(response.statusCode, 200, 'returns a status code of 200')
//   t.deepEqual(response.body.split('\n'), allowedAccounts, 'returns the correct allowlist')
// })

test.serial('POST /:actor/allowlist - success', async t => {
  const actor = 'testActor'
  const accountsToAdd = ['user7@example.com', 'user8@example.com'].join('\n')

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/allowlist`,
    payload: accountsToAdd,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('DELETE /:actor/allowlist - success', async t => {
  const actor = 'testActor'
  const accountsToRemove = ['user7@example.com', 'user8@example.com'].join('\n')

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/allowlist`,
    payload: accountsToRemove,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

// Negative cases for /:actor/blocklist
test.serial('GET /:actor/blocklist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/blocklist`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('POST /:actor/blocklist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'
  const accountsToAdd = 'user9@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/blocklist`,
    payload: accountsToAdd,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/blocklist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'
  const accountsToRemove = 'user9@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/blocklist`,
    payload: accountsToRemove,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Negative cases for /:actor/allowlist
test.serial('GET /:actor/allowlist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/allowlist`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('POST /:actor/allowlist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'
  const accountsToAdd = 'user10@example.com'

  const response = await t.context.server.inject({
    method: 'POST',
    url: `/v1/${actor}/allowlist`,
    payload: accountsToAdd,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/allowlist - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)
  const actor = 'testActor'
  const accountsToRemove = 'user10@example.com'

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/allowlist`,
    payload: accountsToRemove,
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
