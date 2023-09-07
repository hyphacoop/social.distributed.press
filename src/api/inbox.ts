import { APActivity, IdField, APOrderedCollection } from 'activitypub-types'
import { Type } from '@sinclair/typebox'

import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import type ActivityPubSystem from './apsystem.js'

export const inboxRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  // Returns an JSON-LD OrderedCollection with items in the moderation queue
  // Follows / Boosts/ Replies / etc will all be mixed in here
  // Note that items will get auto-denied if they match a user / instance in the blocklist
  // Likewise items will get auto-accepted if they match the allowlist
  server.get<{
    Params: {
      actor: string
    }
    Reply: APOrderedCollection
  }>('/:actor/inbox', {
    schema: {
      params: Type.Object({
        actor: Type.String()
      }),
      description: 'Items in the inbox queue.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { actor } = request.params
    const orderedItems = await store.forActor(actor).inbox.list()
    const orderedCollection: APOrderedCollection = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: request.url,
      orderedItems
    }
    return await reply.send(orderedCollection)
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

    const submittedActor = await apsystem.verifySignedRequest(actor, request)

    // TODO: check that the actor is the one that signed the request
    const activity = request.body
    // TODO: Account for actor being array of strings or nested object
    if (activity.actor !== submittedActor) throw new Error(`Submitted activity must be from signed actor. Activity: ${activity.actor as string} Request: ${submittedActor}`)

    await apsystem.ingestActivity(actor, activity)

    return await reply.send({ message: 'ok' })
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
    await apsystem.rejectActivity(actor, id)
    return await reply.send({ message: 'ok' })
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
    await apsystem.approveActivity(actor, id)

    return await reply.send({ message: 'ok' })
  })
}
