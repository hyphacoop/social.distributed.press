import anyTest, { TestFn } from 'ava'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'

const test = anyTest as TestFn<{ server: FastifyTypebox }>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()
})

test.afterEach.always(async t => {
  await t.context.server?.close()
})

test('health check /healthz', async t => {
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/healthz'
  })
  t.is(response.statusCode, 200, 'returns a status code of 200')
})
