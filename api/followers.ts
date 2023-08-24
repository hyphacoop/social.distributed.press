import { APIConfig, FastifyTypebox } from '.'
import Store from '../store'

export const followerRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of followers as JSON-LD
  server.get('/:domain/followers', async (request, reply) => { })
  // Remove a follower (notifying their server), use URL encoded URL of follower Actor
  server.delete('/:domain/followers/:id', async (request, reply) => { })
}
