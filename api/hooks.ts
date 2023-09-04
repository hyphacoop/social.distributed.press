import { APIConfig, FastifyTypebox } from '.'
import { Type } from '@sinclair/typebox'
import { HookStore, WebHookSchema } from '../store/HookStore'

export const hookRoutes = (cfg: APIConfig, store: HookStore) => async (server: FastifyTypebox): Promise<void> => {
  // For ModerationQueued
  server.put('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: Type.Object(WebHookSchema),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    // const domain = request.params.domain;
    const hook = request.body
    await store.setModerationQueued(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/moderationqueued', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: Type.Object(WebHookSchema)
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the moderation queue.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const hook = await store.getModerationQueued()
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
    await store.deleteModerationQueued()
    return await reply.send({ message: 'Hook deleted successfully' })
  })

  // For OnApprovedHook
  server.put('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: Type.Object(WebHookSchema),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const hook = request.body
    await store.setOnApprovedHook(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/onapproved', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: Type.Object(WebHookSchema)
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the onapproved.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const hook = await store.getOnApprovedHook()
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
    await store.deleteOnApprovedHook()
    return await reply.send({ message: 'Hook deleted successfully' })
  })

  // For OnRejectedHook
  server.put('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      body: Type.Object(WebHookSchema),
      response: {
        200: Type.Object({
          message: Type.String()
        })
      },
      description: 'Sets a hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const hook = request.body
    await store.setOnRejectedHook(hook)
    return await reply.send({ message: 'Hook set successfully' })
  })

  server.get('/:actor/hooks/onrejected', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      response: {
        200: Type.Object({
          hook: Type.Object(WebHookSchema)
        }),
        404: Type.Object({
          message: Type.String()
        })
      },
      description: 'Gets the hook for when an item is added to the onrejected.',
      tags: ['Hooks']
    }
  }, async (request, reply) => {
    const hook = await store.getOnRejectedHook()
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
    await store.deleteOnRejectedHook()
    return await reply.send({ message: 'Hook deleted successfully' })
  })
}
