import { APCollection } from 'activitypub-types'
import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import type Store from '../store'
import type ActivityPubSystem from '../apsystem.js'

export const interactedRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of followers as JSON-LD
  server.get<{
    Params: {
      actor: string
    }
    Reply: APCollection | string
  }>('/:actor/interacted', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      description: 'Interacted users list as an ActivityPub Collection',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params

    if (!(await apsystem.hasPermissionActorRequest(actor, request))) {
      return await reply.status(403).send('unauthorized')
    }

    const actorStore = store.forActor(actor)

    const interacted = await actorStore.interacted.list()
    const totalItems = interacted.length

    const items = (await Promise.all(
      interacted.map(async (mention) => {
        try {
          const url = await apsystem.mentionToActor(mention)
          return url
        } catch {
          // If we can't resolve them just don't show them
          return ''
        }
      })
      // Filter out failed loads
    )).filter((item) => item.length !== 0)

    return await reply.send({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${cfg.publicURL}${request.url}`,
      items,
      totalItems
    })
  })
}
