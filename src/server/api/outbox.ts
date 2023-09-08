import { APActivity } from 'activitypub-types'
import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from '../apsystem.js'

// TODO: Add ability to clear outbox items

export const outboxRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Publishers should POST here to notify followers of new activities
  server.post<{
    Params: {
      actor: string
    }
    Body: APActivity
  }>('/:actor/outbox', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      // TODO: Typebox apoactivity
      body: Type.Object({}),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'ActivityPub outbox for notifying followers',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const activity = request.body

    // TODO: logic for notifying specific followers of replies
    await apsystem.notifyFollowers(actor, activity)
    return await reply.send({ message: 'ok' })
  })
  server.get<{
    Params: {
      actor: string
      id: string
    }
    Reply: APActivity | string
  }>('/:actor/outbox/:id', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        id: Type.String()
      }),
      response: {
      // TODO: typebox apactivity
        200: Type.Object({}),
        409: Type.String()
      },
      description: 'Get items that got sent out by the instance. Fetched by other instances to verify accept/rejects for follows.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, id } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const activity = await apsystem.getOutboxItem(actor, id)

    return await reply.send(activity)
  })
}
