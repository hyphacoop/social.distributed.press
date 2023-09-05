import { APIConfig, FastifyTypebox } from '.'
import { Type } from '@sinclair/typebox'
import Store from '../store/index'
import { WebHookSchema } from '../store/HookStore'

export const hookRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // For ModerationQueued
  server.put('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = request.body
    await store.forActor(actor).hooks.setModerationQueued(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: WebHookSchema
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = await store.forActor(actor).hooks.getModerationQueued()
    if (hook != null) {
      return await reply.send({ message: 'Hook retrieved successfully', hook })
    } else {
      return await reply.code(404).send({ message: 'Hook not found' })
    }
  })

  server.delete('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Deletes a hook for when an item is removed from the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    await store.forActor(actor).hooks.deleteModerationQueued()
    return await reply.send({ message: 'Hook deleted successfully' })
  })

  // For OnApprovedHook
  server.put('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = request.body
    await store.forActor(actor).hooks.setOnApprovedHook(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: WebHookSchema
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = await store.forActor(actor).hooks.getOnApprovedHook()
    if (hook != null) {
      return await reply.send({ message: 'Hook retrieved successfully', hook })
    } else {
      return await reply.code(404).send({ message: 'Hook not found' })
    }
  })

  server.delete('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Deletes a hook for when an item is removed from the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    await store.forActor(actor).hooks.deleteOnApprovedHook()
    return await reply.send({ message: 'Hook deleted successfully' })
  })

  // For OnRejectedHook
  server.put('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: WebHookSchema,
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = request.body
    await store.forActor(actor).hooks.setOnRejectedHook(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: WebHookSchema
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    const hook = await store.forActor(actor).hooks.getOnRejectedHook()
    if (hook != null) {
      return await reply.send({ message: 'Hook retrieved successfully', hook })
    } else {
      return await reply.code(404).send({ message: 'Hook not found' })
    }
  })

  server.delete('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Deletes a hook for when an item is removed from the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const actor = request.params.actor
    await store.forActor(actor).hooks.deleteOnRejectedHook()
    return await reply.send({ message: 'Hook deleted successfully' })
  })
}
