import test from 'ava'
import fastify from 'fastify'
import sinon from 'sinon'
import { adminRoutes } from './admins'
import Store from '../store/index.js'
import ActivityPubSystem from '../apsystem.js'
import { ModerationChecker } from '../moderation.js'
import HookSystem from '../hooksystem'
import { APIConfig } from '.'
import { makeSigner } from '../../keypair.js'
import { generateKeypair } from 'http-signed-fetch'

const mockConfig: APIConfig = {
  port: 3000,
  host: 'localhost',
  storage: 'path/to/storage',
  publicURL: 'http://localhost:3000'
}

let server: any
let mockStore: any
let mockApsystem: any

test.beforeEach(async () => {
  server = fastify()
  mockStore = sinon.createStubInstance(Store)

  mockStore.admins = {
    list: sinon.stub(),
    add: sinon.stub(),
    remove: sinon.stub()
  }
  mockStore.admins.list.resolves(['admin1@example.com', 'admin2@example.com'])
  mockStore.admins.add.resolves()
  mockStore.admins.remove.resolves()

  mockApsystem = new ActivityPubSystem(mockConfig.publicURL, mockStore, new ModerationChecker(mockStore), new HookSystem(mockStore))
  sinon.stub(mockApsystem, 'hasAdminPermissionForRequest').resolves(true)

  await adminRoutes(mockConfig, mockStore, mockApsystem)(server)
})

const simulateSignedRequest = (method: string, path: string): { Signature: string, Date: string } => {
  const keypair = generateKeypair()
  const publicKeyId = 'https://example.com/#main-key'
  const signer = makeSigner(keypair, publicKeyId)

  const url = `${mockConfig.publicURL}${path}`

  // Generate a signature header
  const signatureHeader = signer.sign({
    method,
    url,
    headers: {
      host: 'localhost:3000',
      date: new Date().toUTCString()
    }
  })

  return {
    Signature: signatureHeader,
    Date: new Date().toUTCString()
  }
}

test('GET /admins - success', async t => {
  const signedHeaders = simulateSignedRequest('GET', '/admins')

  mockApsystem.hasAdminPermissionForRequest.callsFake((request: any) => {
    return 'Signature' in request.headers && 'Date' in request.headers
  })

  const response = await server.inject({
    method: 'GET',
    url: '/admins',
    headers: signedHeaders
  })

  t.is(response.statusCode, 200)
  t.is(response.body, 'admin1@example.com\nadmin2@example.com')
})

test('GET /admins - unauthorized', async t => {
  mockApsystem.hasAdminPermissionForRequest.resolves(false)

  const response = await server.inject({
    method: 'GET',
    url: '/admins'
  })

  t.is(response.statusCode, 403)
})

test('POST /admins - success', async t => {
  const signedHeaders = simulateSignedRequest('POST', '/admins')

  const response = await server.inject({
    method: 'POST',
    url: '/admins',
    payload: 'newadmin@example.com',
    headers: {
      'Content-Type': 'text/plain',
      ...signedHeaders
    }
  })

  t.is(response.statusCode, 200)
})

test('POST /admins - unauthorized', async t => {
  mockApsystem.hasAdminPermissionForRequest.resolves(false)

  const response = await server.inject({
    method: 'POST',
    url: '/admins',
    payload: 'newadmin@example.com',
    headers: {
      'Content-Type': 'text/plain'
    }
  })

  t.is(response.statusCode, 403)
})

test('DELETE /admins - success', async t => {
  const signedHeaders = simulateSignedRequest('DELETE', '/admins')

  const response = await server.inject({
    method: 'DELETE',
    url: '/admins',
    payload: 'admin1@example.com',
    headers: {
      'Content-Type': 'text/plain',
      ...signedHeaders
    }
  })

  t.is(response.statusCode, 200)
})

test('DELETE /admins - unauthorized', async t => {
  mockApsystem.hasAdminPermissionForRequest.resolves(false)

  const response = await server.inject({
    method: 'DELETE',
    url: '/admins',
    payload: 'admin1@example.com',
    headers: {
      'Content-Type': 'text/plain'
    }
  })

  t.is(response.statusCode, 403)
})

test.afterEach(async () => {
  await server.close()
})
