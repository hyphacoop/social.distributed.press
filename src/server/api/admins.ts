import { APIConfig, FastifyTypebox } from '.'
import { Type } from '@sinclair/typebox'

import Store from '../store/index.js'
import ActivityPubSystem from '../apsystem.js'

export const adminRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get global list of admins as newline delimited string
  server.get('/admins', {
    schema: {
      response: {
        200: Type.String(),
        403: Type.String()
      },
      description: 'Get global list of admins as newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const admins = await store.admins.list()
    return await reply.type('text/plain').send(admins.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Body: string
  }>('/admins', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        403: Type.String()
      },
      description: 'Add accounts to the global admin list using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.admins.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Body: string
  }>('/admins', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        403: Type.String()
      },
      description: 'Remove accounts from the global admins list using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.admins.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })
}
