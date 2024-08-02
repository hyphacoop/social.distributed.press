import { APCollection } from 'activitypub-types'
import { Type } from '@sinclair/typebox'
import createError from 'http-errors'

import type { APIConfig, FastifyTypebox } from './index.js'
import type Store from '../store/index.js'
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
    let allowed: boolean

    try {
      allowed = await apsystem.hasPermissionActorRequest(actor, request)
    } catch (e) {
      if (createError.isHttpError(e) && e.name === 'UnauthorizedError') {
        allowed = false
      } else {
        throw e
      }
    }

    const collection = await apsystem.followersCollection(actor, !allowed)

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
