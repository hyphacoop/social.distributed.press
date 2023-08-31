import test from 'ava'
import { AccountListStore } from './AccountListStore'
import { MemoryLevel } from 'memory-level'

function newAccountListStore (): AccountListStore {
  return new AccountListStore(new MemoryLevel({ valueEncoding: 'json' }))
}

test('AccountListStore - add and match patterns', async t => {
  const store = newAccountListStore()
  const patterns = ['@user1@example.com', '@*@example.com']
  await store.add(patterns)

  t.true(await store.matches('@user1@example.com'))
  t.true(await store.matches('@user2@example.com')) // Wildcard match
  t.false(await store.matches('@user2@other.com'))

  const accounts = await store.list()

  t.deepEqual(accounts.sort(), patterns.sort())
})

test('AccountListStore - remove patterns', async t => {
  const store = newAccountListStore()
  const patterns = ['@user1@example.com', '@*@example.com']
  await store.add(patterns)
  await store.remove(['@*@example.com'])

  t.false(await store.matches('@user2@example.com')) // Wildcard was removed
  t.true(await store.matches('@user1@example.com'))
})

test('AccountListStore - list patterns', async t => {
  const store = newAccountListStore()
  const patterns = ['@user1@example.com', '@user2@example.com']
  await store.add(patterns)

  let accounts = await store.list()
  t.deepEqual(accounts.sort(), patterns.sort(), 'All patterns should be listed after addition')

  await store.remove(['@user1@example.com'])
  accounts = await store.list()

  t.deepEqual(accounts, ['@user2@example.com'], 'Only @user2@example.com should remain after removal of @user1@example.com')
})

test('AccountListStore - match all wildcard', async t => {
  const store = newAccountListStore()
  const patterns = ['@*@*']
  await store.add(patterns)

  t.true(await store.matches('@user1@example.com'))
  t.true(await store.matches('@user2@example.com'))
  t.true(await store.matches('@user2@other.com'))
})
