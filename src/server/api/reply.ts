import { Type } from '@sinclair/typebox'
import type { APIConfig, FastifyTypebox } from '.'
import type Store from '../store'
import type ActivityPubSystem from '../apsystem.js'

export const replyRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of replies for a post
  server.get<{
    Params: {
      actor: string
      postURL: string
    }
    Reply: string | string[]
  }>('/:actor/replies/:postURL', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        postURL: Type.String() // This will represent the post's URL to fetch the replies for
      }),
      response: {
        200: Type.Array(Type.String()),
        409: Type.String()
      },
      description: 'Get list of replies for a post.',
      tags: ['Replies']
    }
  }, async (request, reply) => {
    const { actor, postURL } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    const replies = await store.forActor(actor).replies.list(postURL)
    const replyUrls = replies.map(r => r.id).filter(Boolean) as string[]
    return await reply.send(replyUrls)
  })

  // Delete a reply from the list
  server.delete<{
    Params: {
      actor: string
      replyURL: string
    }
  }>('/:actor/replies/:replyURL', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        replyURL: Type.String() // This will represent the reply's URL to delete
      }),
      response: {
        200: Type.String(),
        409: Type.String()
      },
      description: 'Delete a reply from the list.',
      tags: ['Replies']
    }
  }, async (request, reply) => {
    const { actor, replyURL } = request.params
    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(409).send('Not Allowed')
    }

    await store.forActor(actor).replies.remove(replyURL)
    return await reply.send('Reply deleted successfully')
  })
}
