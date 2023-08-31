import { APCollection } from 'activitypub-types'
import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import type Store from '../store'
import type ActivityPubSystem from './apsystem.js'

export const followerRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of followers as JSON-LD
  server.get<{
    Params: {
      actor: string
    }
    Reply: APCollection
  }>('/:actor/followers', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      description: 'Follower list as an ActivityPub Collection',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const collection = await apsystem.followersCollection(actor)
    return await reply.send(collection)
  })
  // Remove a follower (notifying their server), use URL encoded URL of follower Actor
  server.delete('/:actor/followers/:id', async (request, reply) => { })
}
