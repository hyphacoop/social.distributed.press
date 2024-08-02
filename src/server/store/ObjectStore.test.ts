/* eslint @typescript-eslint/no-non-null-assertion: 0 */
import test from 'ava'
import { APObjectStore, PUBLIC_TO_URL } from './ObjectStore.js'
import { MemoryLevel } from 'memory-level'
import { APNote } from 'activitypub-types'

function newStore (): APObjectStore {
  return new APObjectStore(new MemoryLevel({ valueEncoding: 'json' }))
}

// Sample data for the tests
const note: APNote = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Note',
  id: 'https://example.com/note1',
  to: [PUBLIC_TO_URL],
  published: new Date().toISOString(),
  attributedTo: 'https://example.com/user1',
  content: 'Hello world'
}

test('APObjectStore - add and get note', async t => {
  const store = newStore()
  await store.add(note)

  const retrievedActivity = await store.get(note.id!)
  t.deepEqual(retrievedActivity, note)
})

test('APObjectStore - list from indexes', async t => {
  const store = newStore()

  const a = { ...note, id: 'a', attributedTo: 'a', inReplyTo: 'example', published: new Date(100).toISOString() }
  const b = { ...note, id: 'b', attributedTo: 'a', published: new Date(200).toISOString() }
  const c = { ...note, id: 'c', attributedTo: 'b', inReplyTo: 'example', published: new Date(300).toISOString() }

  await store.add(a)
  await store.add(b)
  await store.add(c)

  const replies = await store.list({ inReplyTo: a.inReplyTo })
  t.deepEqual(replies, [c, a], 'Got just the replies')

  const fromA = await store.list({ attributedTo: a.attributedTo })
  t.deepEqual(fromA, [b, a], 'Got just notes by a')
})

test('APObjectStore - filter private objects', async t => {
  const store = newStore()
  const exampleTo = 'https://example.com'

  const a = { ...note, to: [exampleTo] }

  await store.add(a)

  const publicList = await store.list()

  t.deepEqual(publicList, [], 'Private note was not listed')

  const privateList = await store.list({ to: exampleTo })

  t.deepEqual(privateList, [a], 'Private posts are listable')
})
