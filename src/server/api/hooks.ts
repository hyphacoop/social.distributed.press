import { APIConfig, FastifyTypebox } from './index.js'
import { Type } from '@sinclair/typebox'
import Store from '../store/index.js'
import { WebHookSchema } from '../store/HookStore.js'
import HookSystem from '../hooksystem.js'
import ActivityPubSystem from '../apsystem.js'

export const hookRoutes = (cfg: APIConfig, store: Store, hookSystem: HookSystem, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // For ModerationQueued
  server.put('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Sets a hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = request.body
    await hookSystem.setModerationQueued(actor, hook)
    return await reply.send('Hook set successfully')
  })

  server.get('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: WebHookSchema,
        409: Type.String()
      },
      description: 'Gets the hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = await hookSystem.getModerationQueued(actor)
    if (hook != null) {
      return await reply.send(hook)
    } else {
      return await reply.code(404).send('Hook not found')
    }
  })

  server.delete('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Deletes a hook for when an item is removed from the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    await hookSystem.deleteModerationQueued(actor)
    return await reply.send('Hook deleted successfully')
  })

  // For OnApprovedHook
  server.put('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Sets a hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = request.body
    await hookSystem.setOnApproved(actor, hook)
    return await reply.send('Hook set successfully')
  })

  server.get('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: WebHookSchema,
        409: Type.String(),
        404: Type.String()
      },
      description: 'Gets the hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = await hookSystem.getOnApproved(actor)
    if (hook != null) {
      return await reply.send(hook)
    } else {
      return await reply.code(404).send('Hook not found')
    }
  })

  server.delete('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Deletes a hook for when an item is removed from the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    await hookSystem.deleteOnApproved(actor)
    return await reply.send('Hook deleted successfully')
  })

  // For OnRejectedHook
  server.put('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Sets a hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = request.body
    await hookSystem.setOnRejected(actor, hook)
    return await reply.send('Hook set successfully')
  })

  server.get('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: WebHookSchema,
        409: Type.String(),
        404: Type.String()
      },
      description: 'Gets the hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    const hook = await hookSystem.getOnRejected(actor)
    if (hook != null) {
      return await reply.send(hook)
    } else {
      return await reply.code(404).send('Hook not found')
    }
  })

  server.delete('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Deletes a hook for when an item is removed from the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }
    await hookSystem.deleteOnRejected(actor)
    return await reply.send('Hook deleted successfully')
  })
}
