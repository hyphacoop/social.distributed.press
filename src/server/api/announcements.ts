import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from '../apsystem'
import type { APActorNonStandard } from '../announcements'
import { Type } from '@sinclair/typebox'

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
    const actor = await apsystem.announcements.getActor()

    return await reply.send(actor)
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
    const actorUrl = apsystem.announcements.actorUrl
    const activity = await apsystem.announcements.store.outbox.get(`${actorUrl}outbox/${request.params.id}`)
    return await reply.send(activity)
  })
}
