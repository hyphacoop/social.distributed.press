import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from './index.js'
import Store, { ActorInfo, ActorInfoSchema } from '../store/index.js'

export const creationRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // Create a new inbox
  server.post<{
    Params: {
      actor: string
    }
    Reply: ActorInfo
    Body: ActorInfo
  }>('/:actor', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: ActorInfoSchema,
      response: {
        200: ActorInfoSchema
      },
      description: 'Register a new actor for the social inbox',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const info = request.body
    await store.forActor(actor).setInfo(info)
    return await reply.send(info)
  })

  // Get info about actor
  server.get<{
    Params: {
      actor: string
    }
    Reply: ActorInfo
  }>('/:actor', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: ActorInfoSchema
      },
      description: 'Load your actor info',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
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
        200: Type.String()
      },
      description: 'Delete a actor',
      tags: ['Creation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    await store.forActor(actor).delete()
    return await reply.send({ message: 'Data deleted successfully' })
  })
}
