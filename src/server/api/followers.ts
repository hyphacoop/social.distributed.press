import { APCollection } from 'activitypub-types'
import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import type Store from '../store'
import type ActivityPubSystem from '../apsystem.js'

export const followerRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of followers as JSON-LD
  server.get<{
    Params: {
      actor: string
    }
    Reply: APCollection | string
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
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    const collection = await apsystem.followersCollection(actor)

    // Allow seeing follower count but not followers
    // TODO: Allow list to be public?
    if (!allowed) {
      delete collection.items
    }

    return await reply.send(collection)
  })

  // Remove a follower (notifying their server), use URL encoded URL of follower Actor
  server.delete<{
    Params: {
      actor: string
      follower: string
    }
    Reply: string
  }>('/:actor/followers/:follower', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        follower: Type.String()
      }),
      description: 'Remove a follower',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, follower } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const exists = await store.forActor(actor).followers.has(follower)

    if (!exists) {
      return await reply.code(404).send('Not Found')
    }

    // TODO: Notify folks via APSystem. Should emit Undo for Accept
    // https://github.com/trustbloc/orb/issues/118
    await store.forActor(actor).followers.remove([follower])

    return await reply.send('OK')
  })
}
