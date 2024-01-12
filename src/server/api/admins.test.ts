import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'

interface TestContext {
  server: FastifyTypebox
  hasAdminPermissionForRequestStub: sinon.SinonStub
}

const test = anyTest as TestFn<TestContext>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()
  t.context.hasAdminPermissionForRequestStub = sinon.stub(ActivityPubSystem.prototype, 'hasAdminPermissionForRequest')
})

test.afterEach.always(async t => {
  await t.context.server?.close()
  t.context.hasAdminPermissionForRequestStub.restore()
})

test.serial('GET /admins - success', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(true)

  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/admins'
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test.serial('GET /admins - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/admins'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('POST /admins - add admins', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(true)

  // Add a new admin
  await t.context.server.inject({
    method: 'POST',
    url: '/v1/admins',
    payload: 'newadmin@example.com',
    headers: { 'Content-Type': 'text/plain' }
  })

  // Fetch the list of admins to verify the addition
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/admins'
  })

  t.is(response.statusCode, 200, 'returns a status code of 200 after adding admin')
  t.deepEqual(response.body.split('\n'), ['newadmin@example.com'], 'Admin list should contain only the new admin')
})

test.serial('POST /admins - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/admins',
    payload: 'newadmin@example.com',
    headers: { 'Content-Type': 'text/plain' }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /admins - remove admins', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(true)

  // Remove an admin
  await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/admins',
    payload: 'removeadmin@example.com',
    headers: { 'Content-Type': 'text/plain' }
  })

  // Fetch the list of admins to verify the removal
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/admins'
  })

  t.is(response.statusCode, 200, 'returns a status code of 200 after removing admin')

  // Filter out empty strings from the response body
  const adminList = response.body.split('\n').filter(admin => admin.trim() !== '')
  t.deepEqual(adminList, [], 'Admin list should be empty after removal')
})

test.serial('DELETE /admins - not allowed', async t => {
  t.context.hasAdminPermissionForRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/admins',
    payload: 'removeadmin@example.com'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
