import test from 'ava'
import Store from './index'
import { MemoryLevel } from 'memory-level'
import { ActorStore } from './ActorStore'

// Helper function to create a new Store instance
function newStore (): Store {
  return new Store(new MemoryLevel({ valueEncoding: 'json' }))
}

test('forActor caches ActorStore', async t => {
  const store = newStore()

  // Call forActor for a domain "example.com"
  const actorStore1 = store.forActor('example.com')

  // Ensure that the actorStore is indeed an instance of ActorStore
  t.true(actorStore1 instanceof ActorStore)

  // Call forActor again for the same domain
  const actorStore2 = store.forActor('example.com')

  // Ensure the returned actorStore is the same as the previous one (cached)
  t.is(actorStore1, actorStore2)
})
