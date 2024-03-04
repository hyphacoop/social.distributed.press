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
  }>('/announcements/', {
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
      inbox: `${actor.actorUrl}inbox`,
      outbox: `${actor.actorUrl}outbox`,
      publicKey: {
        id: `${actor.actorUrl}#main-key`,

        owner: actor.actorUrl,
        publicKeyPem: actor.keypair.publicKeyPem
      }
    })
  })

  server.get<{
    // TODO: typebox APOrderedCollection
    Reply: any
  }>('/announcements/outbox', {
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
    const actor = await store.announcements.getInfo()
    const activities = await store.announcements.outbox.list()
    const orderedItems = activities
      // XXX: maybe `new Date()` doesn't correctly parse possible dates?
      .map(a => ({ ...a, published: typeof a.published === 'string' ? new Date(a.published) : a.published }))
      .sort((a, b) => +(b.published ?? 0) - +(a.published ?? 0))
      .map(a => a.id)
    return await reply.send({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${actor.actorUrl}outbox`,
      type: 'OrderedCollection',
      totalItems: orderedItems.length,
      orderedItems
    })
  })

  server.get<{
    Params: {
      id: string
    }
    // TODO: typebox APOrderedCollection
    Reply: any
  }>('/announcements/outbox/:id', {
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
    const actor = await store.announcements.getInfo()
    const activity = await store.announcements.outbox.get(`${actor.actorUrl}outbox/${request.params.id}`)
    return await reply.send(activity)
  })
}
