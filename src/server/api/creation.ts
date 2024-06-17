import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from './index.js'
import Store, { ActorInfo, ActorInfoSchema } from '../store/index.js'
import ActivityPubSystem from '../apsystem.js'

export const creationRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Create a new inbox
  server.post<{
    Params: {
      actor: string
    }
    Reply: ActorInfo | string
    Body: ActorInfo
  }>('/:actor', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: ActorInfoSchema,
      response: {
        200: ActorInfoSchema,
        403: Type.String()
      },
      description: 'Register a new actor for the social inbox',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params

    const allowed = await apsystem.hasPermissionActorRequest(actor, request, false)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    let existedAlready = false
    try {
      const existingActor = await apsystem.store.forActor(actor).getInfo()
      if (existingActor !== undefined) existedAlready = true
    } catch (err) {
      if (!(err as { notFound: boolean }).notFound) {
        throw err
      }
    }

    const info = request.body
    await store.forActor(actor).setInfo(info)

    const shouldAnnounce = !existedAlready && info.announce === true
    if (shouldAnnounce) await apsystem.announcements.announce(actor)

    return await reply.send(info)
  })

  // Get info about actor
  server.get<{
    Params: {
      actor: string
    }
    Reply: ActorInfo | string
  }>('/:actor', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: ActorInfoSchema,
        403: Type.String()
      },
      description: 'Load your actor info',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const info = await store.forActor(actor).getInfo()
    return await reply.send(info)
  })

  // Delete your inbox data
  server.delete<{
    Params: {
      actor: string
    }
  }>('/:actor', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        403: Type.String()
      },
      description: 'Delete a actor',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    await store.forActor(actor).delete()
    return await reply.code(200).type('application/json').send(JSON.stringify({ message: 'Data deleted successfully' }))
  })
}
