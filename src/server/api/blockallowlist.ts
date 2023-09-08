import { APIConfig, FastifyTypebox } from '.'
import { Type } from '@sinclair/typebox'

import Store from '../store/index.js'
import ActivityPubSystem from '../apsystem.js'

export const blockAllowListRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get global list of blocked users/instances as newline delimited string
  server.get('/blocklist', {
    schema: {
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Get global list of blocked users/instances as newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const blockedAccounts = await store.blocklist.list()
    return await reply.type('text/plain').send(blockedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Body: string
  }>('/blocklist', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Add accounts to the global blocklist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.blocklist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Body: string
  }>('/blocklist', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Remove accounts to the global blocklist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.blocklist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Get global list of auto-approved instances and users, newline delimited string
  server.get('/allowlist', {
    schema: {
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Get global list of auto-approved instances and users, newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const allowedAccounts = await store.allowlist.list()
    return await reply.type('text/plain').send(allowedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Body: string
  }>('/allowlist', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Add accounts to the global allowlist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.allowlist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Body: string
  }>('/allowlist', {
    schema: {
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Remove accounts to the global allowlist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowed = await apsystem.hasAdminPermissionForRequest(request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.allowlist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Get list of blocked users/instances as newline delimited string
  server.get<{
    Params: {
      actor: string
    }
  }>('/:actor/blocklist', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Get list of blocked users/instances for a actor as newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const blockedAccounts = await store.forActor(actor).blocklist.list()
    return await reply.type('text/plain').send(blockedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Params: {
      actor: string
    }
    Body: string
  }>('/:actor/blocklist', {
    schema: {
      consumes: ['text/plain'],
      params: Type.Object({
        actor: Type.String()
      }),
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Add to the blocklist for a actor. Takes newline delimited list in body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.forActor(actor).blocklist.add(accounts)
    return await reply.send('Added successfully')
  })

  // Remove from list, newline delimited body
  server.delete<{
    Params: {
      actor: string
    }
    Body: string
  }>('/:actor/blocklist', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Remove from list, newline delimited body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.forActor(actor).blocklist.remove(accounts)
    return await reply.send('Removed successfully')
  })

  // Get list of auto-approved instances and users, newline delimited string
  server.get<{
    Params: {
      actor: string
    }
  }>('/:actor/allowlist', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Get list of auto-approved instances and users, newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const allowedAccounts = await store.forActor(actor).allowlist.list()
    return await reply.type('text/plain').send(allowedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Params: {
      actor: string
    }
    Body: string
  }>('/:actor/allowlist', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Add to the allowlist, newline delimted list in body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.forActor(actor).allowlist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Params: {
      actor: string
    }
    Body: string
  }>('/:actor/allowlist', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      consumes: ['text/plain'],
      body: Type.String(),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Remove from allowlist, newline delimited body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const accounts = request.body.split('\n')
    await store.forActor(actor).allowlist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })
}
