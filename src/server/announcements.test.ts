import test from 'ava'
import sinon from 'sinon'
import fastify from 'fastify'
import ActivityPubSystem, { FetchLike } from './apsystem.js'
import Store from './store/index.js'
import { ModerationChecker } from './moderation.js'
import HookSystem from './hooksystem.js'
import { MemoryLevel } from 'memory-level'

// Create some mock dependencies
const mockStore = new Store(new MemoryLevel())

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

const aps = new ActivityPubSystem('http://localhost', mockStore, mockModCheck, mockHooks, mockServer.log)

test.beforeEach(async () => {
  // Restore stubs before setting them up again
  sinon.restore()

  sinon.stub(aps, 'mentionToActor').returns(Promise.resolve('http://actor.url'))

  await aps.announcements.init()
})

const keypair = {
  publicKeyPem: 'mockPublicKey',
  privateKeyPem: 'mockPrivateKey',
  publicKeyId: 'mockPublicKeyId'
}

test('actor gets announced on .announce', async t => {
  const fakeActor = '@test@url'
  const actorInfo = {
    actorUrl: 'https://url/@test',
    announce: true,
    keypair,
    publicKeyId: keypair.publicKeyId
  }
  await aps.announcements.announce(fakeActor)
  await aps.store.forActor(fakeActor).setInfo(actorInfo)

  const outbox = await aps.announcements.getOutbox()
  t.is(outbox.totalItems, 1, 'something is in outbox')
})
