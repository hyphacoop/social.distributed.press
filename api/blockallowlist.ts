import { APIConfig, FastifyTypebox } from '.'
import Store from '../store'

export const blockAllowListRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of blocked users/instances as newline delimited string
  server.get('/:domain/blocklist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/:domain/blocklist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/:domain/blocklist', async (request, reply) => { })

  // Get list of auto-approved instances and users, newline delimited string
  server.get('/:domain/allowlist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/:domain/allowlist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/:domain/allowlist', async (request, reply) => { })
}
