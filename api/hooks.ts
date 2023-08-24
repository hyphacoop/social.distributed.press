import { APIConfig, FastifyTypebox } from '.'
import Store from '../store'

export const hookRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // Register hooks for new inbox items that get added to the moderation queue
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onmoderationqueued', async (request, reply) => { })
  server.delete('/:domain/hooks/onmoderationqueued', async (request, reply) => { })
  server.put('/:domain/hooks/onmoderationqueued', async (request, reply) => { })

  // Register hooks for new inbox items that get approved
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onnew', async (request, reply) => { })
  server.delete('/:domain/hooks/onnew', async (request, reply) => { })
  server.put('/:domain/hooks/onnew', async (request, reply) => { })

  // Register hooks for new inbox items that get rejected
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onrejected', async (request, reply) => { })
  server.delete('/:domain/hooks/onrejected', async (request, reply) => { })
  server.put('/:domain/hooks/onrejected', async (request, reply) => { })
}
