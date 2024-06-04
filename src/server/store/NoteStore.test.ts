/* eslint @typescript-eslint/no-non-null-assertion: 0 */
import test from 'ava'
import { NoteStore } from './NoteStore'
import { MemoryLevel } from 'memory-level'
import { APNote } from 'activitypub-types'

function newNoteStore (): NoteStore {
  return new NoteStore(new MemoryLevel({ valueEncoding: 'json' }))
}

// Sample data for the tests
const note: APNote = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Note',
  id: 'https://example.com/note1',
  published: new Date().toISOString(),
  attributedTo: 'https://example.com/user1',
    content: 'Hello world',
}

test('NoteStore - add and get note', async t => {
  const store = newNoteStore()
  await store.add(note)

  const retrievedActivity = await store.get(note.id!)
  t.deepEqual(retrievedActivity, note)
})
