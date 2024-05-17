import test from 'ava'
import http from 'http'
import sinon from 'sinon'
import { SocialInboxClient } from './index.js'
import { generateKeypair } from 'http-signed-fetch'

const instance = 'https://test.instance'
const account = 'testAccount'
const keypair = {
  publicKeyPem: 'mockPublicKey',
  privateKeyPem: 'mockPrivateKey',
  publicKeyId: 'mockPublicKeyId'
}
const mockSignedFetch = sinon.stub()

const client = new SocialInboxClient({ instance, account, keypair, fetch: mockSignedFetch })

async function startTestServer (port: number): Promise<http.Server> {
  return await new Promise<http.Server>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'success' }))
    })

    server.listen(port, () => resolve(server))
  })
}

test('Local Server Communication', async t => {
  const port = 3000
  const server = await startTestServer(port)

  const client = new SocialInboxClient({
    instance: `http://localhost:${port}`,
    account: 'testAccount',
    keypair: { ...generateKeypair(), publicKeyId: 'testAccount#main-key' },
    fetch: globalThis.fetch
  })

  try {
    const response = await client.sendRequest('GET', '/test-path')
    const data = await response.json()
    t.deepEqual(data, { message: 'success' })
  } catch (error) {
    if (error instanceof Error) {
      t.fail(`Error during request: ${error.message}`)
    }
  } finally {
    server.close()
  }
})

// Reset mocks before each test
test.beforeEach(() => {
  mockSignedFetch.reset()
})

test('Actor Info Management', async t => {
  const mockActorInfo = { name: 'Test Actor', inbox: 'https://test.instance/inbox' }

  // Mock Fetch Actor Info
  mockSignedFetch.withArgs(`${instance}/v1/testActor/`, sinon.match.any).resolves(new Response(JSON.stringify(mockActorInfo)))

  // Mock Delete Actor
  mockSignedFetch.withArgs(`${instance}/v1/testActor/`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const actorInfo = await client.getActorInfo('testActor')
  t.deepEqual(actorInfo, mockActorInfo)

  await t.notThrowsAsync(async () => {
    await client.deleteActor('testActor')
  })
})

test('Admin Management', async t => {
  // Mock List Admins
  mockSignedFetch.withArgs(`${instance}/v1/admins`, sinon.match.any).resolves(new Response('admin1\nadmin2'))

  // Mock Add Admins
  mockSignedFetch.withArgs(`${instance}/v1/admins`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove Admins
  mockSignedFetch.withArgs(`${instance}/v1/admins`, sinon.match({ method: 'DELETE' })).resolves(new Response())

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
  mockSignedFetch.withArgs(`${instance}/v1/blocklist`, sinon.match.any).resolves(new Response('blockedUser1\nblockedUser2'))

  // Mock Add to Global Blocklist
  mockSignedFetch.withArgs(`${instance}/v1/blocklist`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove from Global Blocklist
  mockSignedFetch.withArgs(`${instance}/v1/blocklist`, sinon.match({ method: 'DELETE' })).resolves(new Response())

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
  mockSignedFetch.withArgs(`${instance}/v1/allowlist`, sinon.match.any).resolves(new Response('allowedUser1\nallowedUser2'))

  // Mock Add to Global Allowlist
  mockSignedFetch.withArgs(`${instance}/v1/allowlist`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Remove from Global Allowlist
  mockSignedFetch.withArgs(`${instance}/v1/allowlist`, sinon.match({ method: 'DELETE' })).resolves(new Response())

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
  mockSignedFetch.withArgs(`${instance}/v1/testActor/followers`, sinon.match.any).resolves(new Response(JSON.stringify(mockFollowers)))
  mockSignedFetch.withArgs(`${instance}/v1/testActor/followers/follower1`, sinon.match({ method: 'DELETE' })).resolves(new Response())

  const followers = await client.listFollowers('testActor')
  t.deepEqual(followers, mockFollowers)

  await t.notThrowsAsync(async () => {
    await client.removeFollower('follower1', 'testActor')
  })
})

test('Hook Management', async t => {
  // Updated mockHook to explicitly set the method type
  const mockHook = {
    url: 'https://test.hook/endpoint',
    method: 'POST' as 'POST', // Explicitly typing the method
    headers: { 'Content-Type': 'application/json' }
  }

  // Mock Get Hook
  mockSignedFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match.any)
    .resolves(new Response(JSON.stringify(mockHook)))

  // Mock Set Hook
  mockSignedFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match({ method: 'PUT' }))
    .resolves(new Response())

  // Mock Delete Hook
  mockSignedFetch.withArgs(`${instance}/v1/testActor/hooks/testHook`, sinon.match({ method: 'DELETE' }))
    .resolves(new Response())

  const hook = await client.getHook('testHook', 'testActor')
  t.deepEqual(hook, mockHook)

  await t.notThrowsAsync(async () => {
    await client.setHook('testHook', mockHook.url, mockHook.method, mockHook.headers, 'testActor')
  })

  await t.notThrowsAsync(async () => {
    await client.deleteHook('testHook', 'testActor')
  })
})

test('Inbox Management', async t => {
  const mockInboxItems = [{ type: 'Note', content: 'Hello world!' }]

  // Mock Fetch Inbox for default actor
  mockSignedFetch.withArgs(`${instance}/v1/${account}/inbox`, sinon.match.any).resolves(new Response(JSON.stringify(mockInboxItems)))

  // Mock Post to Inbox
  mockSignedFetch.withArgs(`${instance}/v1/testActor/inbox`, sinon.match({ method: 'POST' })).resolves(new Response())

  const inboxItems = await client.fetchInbox()
  t.deepEqual(inboxItems, mockInboxItems)

  await t.notThrowsAsync(async () => {
    await client.postToInbox({ type: 'Note', content: 'Test note' }, 'testActor')
  })
})

test('Outbox Management', async t => {
  const mockOutboxItem = { type: 'Note', content: 'Test outbox note' }

  // Mock Post to Outbox
  mockSignedFetch.withArgs(`${instance}/v1/testActor/outbox`, sinon.match({ method: 'POST' })).resolves(new Response())

  // Mock Fetch Outbox Item for default actor
  mockSignedFetch.withArgs(`${instance}/v1/${account}/outbox/123`, sinon.match.any).resolves(new Response(JSON.stringify(mockOutboxItem)))

  // Mock Fetch Outbox Item for a specific actor
  mockSignedFetch.withArgs(`${instance}/v1/specificActor/outbox/123`, sinon.match.any).resolves(new Response(JSON.stringify(mockOutboxItem)))

  await t.notThrowsAsync(async () => {
    await client.postToOutbox({ type: 'Note', content: 'Test note' }, 'testActor')
  })

  // Test fetching outbox item for default actor
  const defaultActorOutboxItem = await client.fetchOutboxItem('123')
  t.deepEqual(defaultActorOutboxItem, mockOutboxItem)

  // Test fetching outbox item for a specific actor
  const specificActorOutboxItem = await client.fetchOutboxItem('123', 'specificActor')
  t.deepEqual(specificActorOutboxItem, mockOutboxItem)
})
