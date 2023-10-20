/* eslint @typescript-eslint/no-non-null-assertion: 0 */
import test from 'ava'
import { ReplyStore } from './ReplyStore'
import { MemoryLevel } from 'memory-level'
import { APActivity } from 'activitypub-types'

// Helper function to instantiate a new ReplyStore with an in-memory database
function newReplyStore (): ReplyStore {
  return new ReplyStore(new MemoryLevel({ valueEncoding: 'json' }))
}

// Sample data for the tests
const reply: APActivity = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  actor: 'https://example.com/user2',
  object: {
    type: 'Note',
    content: 'This is a reply',
    id: 'https://example.com/note2',
    inReplyTo: 'https://example.com/originalNote'
  },
  id: 'https://example.com/activity2'
}

test('ReplyStore - add and get reply', async t => {
  const store = newReplyStore()
  await store.add(reply)

  const retrievedReply = await store.get(reply.id!)
  t.deepEqual(retrievedReply, reply)
})

test('ReplyStore - remove reply', async t => {
  const store = newReplyStore()
  await store.add(reply)
  await store.remove(reply.id!)
  // Ensure the reply is deleted
  await t.throwsAsync(async () => {
    await store.get(reply.id!)
  }, {
    instanceOf: Error,
    message: `Activity not found for URL: ${reply.id!}`
  })
})

test('ReplyStore - list replies', async t => {
  const store = newReplyStore()
  await store.add(reply)

  const replies = await store.list(reply.id!)
  t.deepEqual(replies, [reply])
})
