/* eslint @typescript-eslint/no-non-null-assertion: 0 */
import test from 'ava'
import { ActivityStore, LATEST_VERSION } from './ActivityStore'
import { MemoryLevel } from 'memory-level'
import { APActivity } from 'activitypub-types'

function newActivityStore (): ActivityStore {
  return new ActivityStore(new MemoryLevel({ valueEncoding: 'json' }))
}

// Sample data for the tests
const activity: APActivity = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  published: new Date().toISOString(),
  actor: 'https://example.com/user1',
  object: {
    type: 'Note',
    content: 'Hello world',
    id: 'https://example.com/note1'
  },
  id: 'https://example.com/activity1'
}

test('ActivityStore - add and get activity', async t => {
  const store = newActivityStore()
  await store.add(activity)

  const retrievedActivity = await store.get(activity.id!)
  t.deepEqual(retrievedActivity, activity)
  t.deepEqual(await store.count(), 1, 'activity in count')
})

test('ActivityStore - remove activity', async t => {
  const store = newActivityStore()
  await store.add(activity)

  await store.remove(activity.id!)

  // Ensure the activity is deleted
  await t.throwsAsync(async () => {
    await store.get(activity.id!)
  }, {
    instanceOf: Error,
    message: `Activity not found for URL: ${activity.id!}`
  })

  const items = await store.list()

  t.deepEqual(items, [], 'No items left after remove')
  t.deepEqual(await store.count(), 0, 'count is now 0')
})

test('ActivityStore - list activities', async t => {
  const store = newActivityStore()
  const d1 = new Date(40000).toISOString()
  const d2 = new Date(200000).toISOString()
  const id1 = 'b'
  const id2 = 'a'
  const a1 = { ...activity, id: id1, published: d1 }
  const a2 = { ...activity, id: id2, published: d2 }
  await store.add(a1)
  await store.add(a2)

  const activities = await store.list()
  // Should be newest first
  t.deepEqual(activities, [a2, a1])

  t.deepEqual(await store.count(), activities.length, 'count matches list length')
})

test('ActivityStore - list activites without dates', async t => {
  const store = newActivityStore()
  const id1 = 'b'
  const id2 = 'a'
  const a1 = { ...activity, id: id1 }
  const a2 = { ...activity, id: id2 }
  delete a1.published
  delete a2.published
  await store.add(a1)
  await store.add(a2)

  const activities = await store.list()
  // Should be newest first
  t.deepEqual(activities, [a2, a1])
  t.deepEqual(await store.count(), activities.length, 'count matches list length')
})

test('ActivityStore - migrate store', async t => {
  const store = newActivityStore()

  // TODO: find better ways to simulate pre-migrated db
  const key = store.urlToKey(activity.id as string)
  await store.db.put(key, activity)

  const initialVersion = await store.getVersion()
  t.deepEqual(initialVersion, '0', 'initial version is 0')

  await store.migrate()

  const version = await store.getVersion()
  t.deepEqual(version, LATEST_VERSION, 'after migrating, store at latest version')

  const activites = await store.list()

  t.deepEqual(activites, [activity], 'Able to list after migration')
})
