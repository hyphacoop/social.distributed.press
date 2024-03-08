import { APActor } from 'activitypub-types'

import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from '../apsystem'
import { Type } from '@sinclair/typebox'

type APActorNonStandard = APActor & {
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
}

export const announcementsRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  server.get<{
    Reply: APActorNonStandard
  }>(`/${apsystem.announcements.mention}/`, {
    schema: {
      params: {},
      // XXX: even with Type.Any(), the endpoint returns `{}` :/
      // response: {
      //   // TODO: typebox APActor
      //   200: Type.Any()
      // },
      description: 'Announcements ActivityPub actor',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const actor = apsystem.announcements.getActor()
    const actorInfo = await actor.getInfo()

    return await reply.send({
      '@context': [
        // TODO: I copied this from Mastodon, is this correct?
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      // https://www.w3.org/TR/activitystreams-vocabulary/#actor-types
      type: 'Service',
      name: 'Announcements',
      inbox: `${actorInfo.actorUrl}inbox`,
      outbox: `${actorInfo.actorUrl}outbox`,
      publicKey: {
        id: `${actorInfo.actorUrl}#main-key`,

        owner: actorInfo.actorUrl,
        publicKeyPem: actorInfo.keypair.publicKeyPem
      }
    })
  })

  server.get<{
    // TODO: typebox APOrderedCollection
    Reply: any
  }>(`/${apsystem.announcements.mention}/outbox`, {
    schema: {
      params: {},
      // XXX: even with Type.Any(), the endpoint returns `{}` :/
      // response: {
      //   // TODO: typebox APOrderedCollection
      //   200: Type.Any()
      // },
      description: 'Announcements ActivityPub outbox',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    return await reply.send(await apsystem.announcements.getOutbox())
  })

  server.get<{
    Params: {
      id: string
    }
    // TODO: typebox APOrderedCollection
    Reply: any
  }>(`/${apsystem.announcements.mention}/outbox/:id`, {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      // XXX: even with Type.Any(), the endpoint returns `{}` :/
      // response: {
      //   // TODO: typebox APOrderedCollection
      //   200: Type.Any()
      // },
      description: 'Announcements ActivityPub get activity',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const actor = apsystem.announcements.getActor()
    const actorInfo = await actor.getInfo()
    const activity = await actor.outbox.get(`${actorInfo.actorUrl}outbox/${request.params.id}`)
    return await reply.send(activity)
  })
}
