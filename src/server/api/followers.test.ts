import anyTest, { TestFn } from 'ava'
import sinon from 'sinon'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'
import { APCollection } from 'activitypub-types'

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
      followers: {
        add: sinon.stub().resolves(),
        has: sinon.stub().resolves(true),
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

// Test for GET /:actor/followers
test.serial('GET /:actor/followers - success', async t => {
  const actor = 'testActor'
  t.context.hasPermissionActorRequestStub.resolves(true)

  // Mock followers collection for the test actor
  const mockedCollection: APCollection = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `http://localhost:3000/v1/${actor}/followers`,
    type: 'OrderedCollection',
    totalItems: 1,
    items: [
      'http://localhost:3000/v1/follower1'
    ]
  }
  sinon.stub(ActivityPubSystem.prototype, 'followersCollection').resolves(mockedCollection)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/followers`
  })

  t.is(response.statusCode, 200, 'returns a status code of 200')
  t.truthy(response.body, 'returns a collection of followers')
})

test.serial('GET /:actor/followers - not allowed', async t => {
  const actor = 'testActor'
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'GET',
    url: `/v1/${actor}/followers`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

// test.serial('DELETE /:actor/followers/:follower - success', async t => {
//   const actor = 'testActor';
//   const follower = 'followerId';
//   t.context.hasPermissionActorRequestStub.resolves(true);

//   // Setup the mockStore to simulate the follower exists
//   t.context.mockStore.forActor(actor).followers.has.withArgs(follower).resolves(true);

//   const response = await t.context.server.inject({
//     method: 'DELETE',
//     url: `/v1/${actor}/followers/${follower}`
//   });

//   console.log('Response for DELETE /followers/:follower:', response.body);

//   t.is(response.statusCode, 200, 'returns a status code of 200');
//   t.is(response.body, 'OK', 'returns confirmation of deletion');
// });

test.serial('DELETE /:actor/followers/:follower - not allowed', async t => {
  const actor = 'testActor'
  const follower = 'followerId'
  t.context.hasPermissionActorRequestStub.resolves(false)

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/followers/${follower}`
  })

  t.is(response.statusCode, 403, 'returns a status code of 403')
})

test.serial('DELETE /:actor/followers/:follower - not found', async t => {
  const actor = 'testActor'
  const follower = 'nonexistentFollower'
  t.context.hasPermissionActorRequestStub.resolves(true)

  const response = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/${actor}/followers/${follower}`
  })

  t.is(response.statusCode, 404, 'returns a status code of 404')
})
