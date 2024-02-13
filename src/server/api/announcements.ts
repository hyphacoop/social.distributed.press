import { APActor } from 'activitypub-types'

import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from '../apsystem'

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
  }>('/announcements', {
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
    // return await reply.send({ prueba: 'asdfasd' })
    const actor = await store.announcements.getInfo()

    return await reply.send({
      '@context': [
        // TODO: I copied this from Mastodon, is this correct?
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      // https://www.w3.org/TR/activitystreams-vocabulary/#actor-types
      type: 'Service',
      name: 'Announcements',
      inbox: `${actor.actorUrl}/inbox`,
      outbox: `${actor.actorUrl}/outbox`,
      publicKey: {
        // TODO: copied from Mastodon
        id: `${actor.actorUrl}#main-key`,

        owner: actor.actorUrl,
        publicKeyPem: actor.keypair.publicKeyPem
      }
    })
  })
}
