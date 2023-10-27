/* eslint @typescript-eslint/no-non-null-assertion: 0 */
import test from 'ava'
import { ReplyStore } from './ReplyStore'
import { MemoryLevel } from 'memory-level'
import { APActivity } from 'activitypub-types'

function newReplyStore (): ReplyStore {
  return new ReplyStore(new MemoryLevel({ valueEncoding: 'json' }))
}

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

// Assert object type and get 'inReplyTo' value safely
function inReplyToValue (obj: any): string {
  if (typeof obj === 'object' && obj !== null && 'inReplyTo' in obj) {
    return obj.inReplyTo
  }
  throw new Error('inReplyTo not found in object')
}

test('ReplyStore - add and get reply', async t => {
  const store = newReplyStore()
  await store.add(reply)

  const retrievedReplies = await store.list('https://example.com/originalNote')
  t.deepEqual(retrievedReplies, [reply.object])
})

test('ReplyStore - remove reply', async t => {
  const store = newReplyStore()
  await store.add(reply)

  const postURL = inReplyToValue(reply.object)
  await store.forPost(postURL).remove(reply.id!)

  await t.throwsAsync(async () => {
    await store.forPost(postURL).get(reply.id!)
  }, {
    instanceOf: Error,
    message: `Object not found for URL: ${reply.id!}`
  })
})

test('ReplyStore - list replies', async t => {
  const store = newReplyStore()
  await store.add(reply)

  const postURL = inReplyToValue(reply.object)
  const replies = await store.list(postURL)
  t.deepEqual(replies, [reply.object])
})
