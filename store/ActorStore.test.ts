import test from 'ava'
import Store from './index'
import { MemoryLevel } from 'memory-level'
import { APIConfig, paths } from '../api/index.js'
import { ActorStore } from './ActorStore'

// Helper function to create a new Store instance
function newStore (config: APIConfig): Store {
  return new Store(config, new MemoryLevel({ valueEncoding: 'json' }))
}

test('forActor caches ActorStore', async t => {
  const config: APIConfig = {
    // required by ServerI
    port: 8080,
    host: 'localhost',
    // optional, choose appropriate mock value
    useLogging: false,
    useSwagger: false,
    usePrometheus: false,
    useMemoryBackedDB: true,
    useSigIntHandler: true,
    storage: paths.data // mock storage value from ServerI
  }

  const store = newStore(config)

  // Call forActor for a domain "example.com"
  const actorStore1 = store.forActor('example.com')

  // Ensure that the actorStore is indeed an instance of ActorStore
  t.true(actorStore1 instanceof ActorStore)

  // Call forActor again for the same domain
  const actorStore2 = store.forActor('example.com')

  // Ensure the returned actorStore is the same as the previous one (cached)
  t.is(actorStore1, actorStore2)
})
