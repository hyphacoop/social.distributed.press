import { APActivity, IdField, APOrderedCollectionPage, APOrderedCollection } from 'activitypub-types'
import { Static, Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from '../apsystem.js'
import createError from 'http-errors'

const GetInboxQuerySchema = Type.Object({
  skip: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number())
})

export const inboxRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Returns an JSON-LD OrderedCollection with items in the moderation queue
  // Follows / Boosts/ Replies / etc will all be mixed in here
  // Note that items will get auto-denied if they match a user / instance in the blocklist
  // Likewise items will get auto-accepted if they match the allowlist
  server.get<{
    Params: {
      actor: string
    }
    Querystring: Static<typeof GetInboxQuerySchema>
    Reply: APOrderedCollectionPage | string
  }>('/:actor/inbox', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      querystring: GetInboxQuerySchema,
      description: 'Items in the inbox queue.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    let { skip, limit } = request.query

    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const inbox = store.forActor(actor).inbox
    const totalItems = await inbox.count()

    if (limit === undefined) {
      const inbox: APOrderedCollection = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        totalItems,
        id: `${cfg.publicURL}${request.url}`,
        first: `${cfg.publicURL}/v1/${actor}/inbox?limit=100`
      }
      return await reply.send(inbox)
    }
    skip ??= 0

    const hasPrev = skip > limit
    const prev = hasPrev ? `${cfg.publicURL}/v1/${actor}/inbox?skip=${skip - limit}&limit=${limit}` : undefined
    const orderedItems = await inbox.list({ skip, limit })
    const next = (orderedItems.length >= limit) ? `${cfg.publicURL}/v1/${actor}/inbox?skip=${skip + limit}&limit=${limit}` : undefined
    const orderedCollectionPage: APOrderedCollectionPage = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollectionPage',
      totalItems,
      id: `${cfg.publicURL}${request.url}`,
      prev,
      next,
      orderedItems
    }
    return await reply.send(orderedCollectionPage)
  })

  // This is what instances will POST to in order to notify of follows/replies/etc
  server.post<{
    Params: {
      actor: string
    }
    Body: APActivity
  }>('/:actor/inbox', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      // TODO: Typebox apoactivity
      body: Type.Object({}),
      response: {
        200: Type.String()
      },
      description: 'ActivityPub inbox for your actor.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params

    const submittedActorMention = await apsystem.verifySignedRequest(request, actor)
    const submittedActorURL = await apsystem.mentionToActor(submittedActorMention)

    // TODO: check that the actor is the one that signed the request
    const activity = request.body

    const fromActorURL = activity.actor

    // TODO: Account for actor being array of strings or nested object
    if (typeof fromActorURL !== 'string') {
      throw createError(400, 'Must specify `actor` URL in activity')
    }

    if (fromActorURL !== submittedActorURL) {
      throw createError(403, `Submitted activity must be from signed actor. Activity: ${fromActorURL} Request: ${submittedActorURL}`)
    }
    await apsystem.ingestActivity(actor, activity)

    return await reply.send({ message: 'ok' })
  })

  // TODO: Paging?
  server.get<{
    Params: {
      actor: string
      inReplyTo: string
    }
    Reply: APOrderedCollection | string
  }>('/:actor/inbox/replies/:inReplyTo', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        inReplyTo: Type.String()
      }),
      description: 'Replies for a post',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, inReplyTo } = request.params

    let to: string | undefined

    // Only try to set `to` if it's a signed request
    if (request.headers.signature !== undefined) {
      const submittedActorMention = await apsystem.verifySignedRequest(request, actor)
      to = await apsystem.mentionToActor(submittedActorMention)
    }
    const replyURL = inReplyTo.includes('%') ? decodeURIComponent(inReplyTo) : atob(inReplyTo)
    request.log.info({ replyURL }, 'fetching replies for post')

    const collection = await apsystem.repliesCollection(actor, replyURL, to)

    return await reply.send(collection)
  })

  // TODO: Paging?
  server.get<{
    Params: {
      actor: string
      object: string
    }
    Reply: APOrderedCollection | string
  }>('/:actor/inbox/likes/:object', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        object: Type.String()
      }),
      description: 'Likes for a post',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, object } = request.params

    const allowed = await apsystem.hasPermissionActorRequest(actor, request)

    const objectURL = object.includes('%') ? decodeURIComponent(object) : atob(object)
    request.log.info({ objectURL }, 'fetching likes for post')

    const collection = await apsystem.likesCollection(actor, objectURL, allowed)

    return await reply.send(collection)
  })

  // TODO: Paging?
  server.get<{
    Params: {
      actor: string
      object: string
    }
    Reply: APOrderedCollection | string
  }>('/:actor/inbox/shares/:object', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        object: Type.String()
      }),
      description: 'Shares or boosts for a post',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, object } = request.params

    const allowed = await apsystem.hasPermissionActorRequest(actor, request)

    const objectURL = object.includes('%') ? decodeURIComponent(object) : atob(object)
    request.log.info({ objectURL }, 'fetching shares for post')

    const collection = await apsystem.sharesCollection(actor, objectURL, allowed)

    return await reply.send(collection)
  })
  // Deny a follow request/boost/etc
  // The ID is the URL encoded id from the inbox activity
  server.delete<{
    Params: {
      actor: string
      id: IdField
    }
  }>('/:actor/inbox/:id', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        id: Type.String()
      }),
      // TODO: Typebox apoactivity
      response: {
        200: Type.String()
      },
      description: 'Reject an Activity in your inbox',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, id } = request.params

    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const idURL = id.includes('%') ? decodeURIComponent(id) : atob(id)

    await apsystem.rejectActivity(actor, idURL)
    return await reply.send('ok')
  })

  // Approve the item from the inbox
  server.post<{
    Params: {
      actor: string
      id: IdField
    }
  }>('/:actor/inbox/:id', {
    schema: {
      params: Type.Object({
        actor: Type.String(),
        id: Type.String()
      }),
      // TODO: Typebox apoactivity
      response: {
        200: Type.String()
      },
      description: 'Approve an Activity in your inbox',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor, id } = request.params

    const allowed = await apsystem.hasPermissionActorRequest(actor, request)
    if (!allowed) {
      return await reply.code(403).send('Not Allowed')
    }

    const idURL = id.includes('%') ? decodeURIComponent(id) : atob(id)

    await apsystem.approveActivity(actor, idURL)

    return await reply.send('ok')
  })
}
