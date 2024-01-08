import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'

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

const actorInfo = {
  actorUrl: 'https://test.instance/actorUrl',
  publicKeyId: 'https://test.instance/publicKeyId',
  keypair: {
    publicKeyPem: 'publicKeyData',
    privateKeyPem: 'privateKeyData'
  }
}

// Test for POST /:actor
test.serial('POST /:actor - success', async t => {
  t.context.hasPermissionActorRequestStub.resolves(true)

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/testActor',
    payload: JSON.stringify(actorInfo),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  const responseBody = JSON.parse(response.body)
  t.deepEqual(responseBody, actorInfo, 'returns the actor info')
})

test.serial('POST /:actor - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/testActor',
    payload: JSON.stringify(actorInfo),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Test for GET /:actor
test.serial('GET /:actor - success', async t => {
  // Create an actor first
  await t.context.server.inject({
    method: 'POST',
    url: '/v1/testActor',
    payload: JSON.stringify(actorInfo),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // Perform the GET request
  t.context.hasPermissionActorRequestStub.resolves(true)
  const getResponse = await t.context.server.inject({
    method: 'GET',
    url: '/v1/testActor'
  })

  t.is(getResponse.statusCode, 200, 'returns a status code of 200')
  const getResponseBody = JSON.parse(getResponse.body)
  t.deepEqual(getResponseBody, actorInfo, 'returns the expected actor info')
})

test.serial('GET /:actor - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: '/v1/testActor'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// Test for DELETE /:actor
test.serial('DELETE /:actor - success', async t => {
  // Ensure the actor exists before deletion
  await t.context.server.inject({
    method: 'POST',
    url: '/v1/testActor',
    payload: JSON.stringify(actorInfo),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // Perform the DELETE request
  t.context.hasPermissionActorRequestStub.resolves(true)
  const deleteResponse = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/testActor'
  })

  const deleteResponseBody = JSON.parse(deleteResponse.body)
  t.is(deleteResponse.statusCode, 200, 'returns a status code of 200')
  t.deepEqual(deleteResponseBody, { message: 'Data deleted successfully' }, 'returns success message')
})

test.serial('DELETE /:actor - not allowed', async t => {
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: '/v1/testActor'
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})
