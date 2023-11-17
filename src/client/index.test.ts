import test from 'ava'
import sinon from 'sinon'
import { SocialInboxClient } from './index'

const instance = 'https://test.instance'
const account = 'testAccount'
const keypair = {
  publicKeyPem: 'mockPublicKey',
  privateKeyPem: 'mockPrivateKey'
}
const mockFetch = sinon.stub()

const client = new SocialInboxClient({ instance, account, keypair, fetch: mockFetch })

// Reset mocks before each test
test.beforeEach(() => {
  mockFetch.reset()
})

test('Actor Info Management', async t => {
  const mockActorInfo = { name: 'Test Actor', inbox: 'https://test.instance/inbox' }

  // Mock Fetch Actor Info
  mockFetch.withArgs(`${instance}/v1/testActor/`, sinon.match.any).resolves(new Response(JSON.stringify(mockActorInfo)))

  // Mock Delete Actor
  mockFetch.withArgs(`${instance}/v1/testActor/`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const actorInfo = await client.getActorInfo('testActor')
  t.deepEqual(actorInfo, mockActorInfo)

  await t.notThrowsAsync(async () => {
    await client.deleteActor('testActor')
  })
})

test('Admin Management', async t => {
  // Mock List Admins
  mockFetch.withArgs(`${instance}/v1/admins`, sinon.match.any).resolves(new Response('admin1\nadmin2'))

  // Mock Add Admins
  mockFetch.withArgs(`${instance}/v1/admins`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove Admins
  mockFetch.withArgs(`${instance}/v1/admins`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const list = await client.listAdmins()
  t.deepEqual(list, ['admin1', 'admin2'])

  await t.notThrowsAsync(async () => {
    await client.addAdmins(['admin3'])
  })

  await t.notThrowsAsync(async () => {
    await client.removeAdmins(['admin1'])
  })
})

test('Blocklist Management', async t => {
  // Mock Get Global Blocklist
  mockFetch.withArgs(`${instance}/v1/blocklist`, sinon.match.any).resolves(new Response('blockedUser1\nblockedUser2'))

  // Mock Add to Global Blocklist
  mockFetch.withArgs(`${instance}/v1/blocklist`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove from Global Blocklist
  mockFetch.withArgs(`${instance}/v1/blocklist`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const blocklist = await client.getGlobalBlocklist()
  t.deepEqual(blocklist, ['blockedUser1', 'blockedUser2'])

  await t.notThrowsAsync(async () => {
    await client.addGlobalBlocklist(['blockedUser3'])
  })

  await t.notThrowsAsync(async () => {
    await client.removeGlobalBlocklist(['blockedUser1'])
  })
})

test('Allowlist Management', async t => {
  // Mock Get Global Allowlist
  mockFetch.withArgs(`${instance}/v1/allowlist`, sinon.match.any).resolves(new Response('allowedUser1\nallowedUser2'))

  // Mock Add to Global Allowlist
  mockFetch.withArgs(`${instance}/v1/allowlist`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove from Global Allowlist
  mockFetch.withArgs(`${instance}/v1/allowlist`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const allowlist = await client.getGlobalAllowlist()
  t.deepEqual(allowlist, ['allowedUser1', 'allowedUser2'])

  await t.notThrowsAsync(async () => {
    await client.addGlobalAllowlist(['allowedUser3'])
  })

  await t.notThrowsAsync(async () => {
    await client.removeGlobalAllowlist(['allowedUser1'])
  })
})

test('Follower Management', async t => {
  const mockFollowers = ['follower1', 'follower2']
  mockFetch.withArgs(`${instance}/v1/testActor/followers`, sinon.match.any).resolves(new Response(JSON.stringify(mockFollowers)))
  mockFetch.withArgs(`${instance}/v1/testActor/followers/follower1`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const followers = await client.listFollowers('testActor')
  t.deepEqual(followers, mockFollowers)

  await t.notThrowsAsync(async () => {
    await client.removeFollower('testActor', 'follower1')
  })
})

test('Hook Management', async t => {
  const mockHook = { url: 'https://test.hook/endpoint', secret: 'secretKey' }

  // Mock Get Hook
  mockFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match.any).resolves(new Response(JSON.stringify(mockHook)))

  // Mock Set Hook
  mockFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Delete Hook
  mockFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const hook = await client.getHook('testActor', 'testHook')
  t.deepEqual(hook, mockHook)

  await t.notThrowsAsync(async () => {
    await client.setHook('testActor', 'testHook', mockHook)
  })

  await t.notThrowsAsync(async () => {
    await client.deleteHook('testActor', 'testHook')
  })
})

test('Inbox Management', async t => {
  const mockInboxItems = [{ type: 'Note', content: 'Hello world!' }]

  // Mock Fetch Inbox
  mockFetch.withArgs(`${instance}/v1/testActor/inbox`, sinon.match.any).resolves(new Response(JSON.stringify(mockInboxItems)))

  // Mock Post to Inbox
  mockFetch.withArgs(`${instance}/v1/testActor/inbox`, sinon.match({ method: 'POST' })).resolves(new Response())

  const inboxItems = await client.fetchInbox('testActor')
  t.deepEqual(inboxItems, mockInboxItems)

  await t.notThrowsAsync(async () => {
    await client.postToInbox('testActor', { type: 'Note', content: 'Test note' })
  })
})

test('Outbox Management', async t => {
  const mockOutboxItem = { type: 'Note', content: 'Test outbox note' }

  // Mock Post to Outbox
  mockFetch.withArgs(`${instance}/v1/testActor/outbox`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Fetch Outbox Item
  mockFetch.withArgs(`${instance}/v1/testActor/outbox/123`, sinon.match.any).resolves(new Response(JSON.stringify(mockOutboxItem)))

  await t.notThrowsAsync(async () => {
    await client.postToOutbox('testActor', { type: 'Note', content: 'Test note' })
  })

  const outboxItem = await client.fetchOutboxItem('testActor', '123')
  t.deepEqual(outboxItem, mockOutboxItem)
})
