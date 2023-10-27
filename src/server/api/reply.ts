import { Type } from '@sinclair/typebox'
import type { APIConfig, FastifyTypebox } from '.'
import type Store from '../store'
import type ActivityPubSystem from '../apsystem.js'
import { APOrderedCollection } from 'activitypub-types'

export const replyRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Get list of replies for a post
  server.get<{
    Params: {
      actor: string
      postURL: string
    }
    Reply: APOrderedCollection | string
  }>('/:actor/replies/:postURL', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        postURL: Type.String() // This will represent the post's URL to fetch the replies for
      }),
      response: {
        200: Type.Object({}),
        409: Type.String()
      },
      description: 'Get list of replies for a post.',
      tags: ['Replies']
    }
  }, async (request, reply) => {
    const { actor, postURL } = request.params

    const replies = await store.forActor(actor).replies.list(postURL)
    const replyUrls = replies.map(r => r.id).filter(Boolean) as string[]

    const orderedCollection: APOrderedCollection = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: request.url,
      orderedItems: replyUrls
    }

    return await reply.send(orderedCollection)
  })

  // Delete a reply from the list
  server.delete<{
    Params: {
      actor: string
      postURL: string
      replyURL: string
    }
  }>('/:actor/replies/:postURL/:replyURL', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        postURL: Type.String(), // This will represent the post's URL
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
    const { actor, postURL, replyURL } = request.params

    await store.forActor(actor).replies.forPost(postURL).remove(replyURL)
    return await reply.send('Reply deleted successfully')
  })
}
