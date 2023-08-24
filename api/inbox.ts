import { APActivity, IdField } from 'activitypub-types'
import type { APIConfig, FastifyTypebox } from '.'
import Store from '../store'
import { Type } from '@sinclair/typebox'
import signatureParser from 'activitypub-http-signatures'

export const inboxRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  // Create a new inbox
  server.post('/:domain/inbox', async (request, reply) => { })

  // Returns an JSON-LD OrderedCollection with items in the moderation queue
  // Follows / Boosts/ Replies / etc will all be mixed in here
  // Note that items will get auto-denied if they match a user / instance in the blocklist
  // Likewise items will get auto-accepted if they match the allowlist
  server.get<{
    Params: {
      domain: string
    }
    Reply: APActivity[]
  }>('/:domain/inbox', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      description: 'Items in the inbox queue.'
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const activities = await store.forDomain(domain).inbox.list()
    return await reply.send(activities)
  })

  // This is what instances will POST to in order to notify of follows/replies/etc
  server.post<{
    Params: {
      domain: string
    }
    Body: APActivity
  }>('/:domain/inbox', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      body: Type.Object({}),
      response: {
        200: Type.String()
      },
      description: 'ActivityPub inbox for your domain.'
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const { url, method, headers } = request
    const signature = signatureParser.parse({ url, method, headers })
    const { keyId } = signature

    // Get the public key object using the provided key ID
    const keyRes = await fetch(
      keyId,
      {
        headers: {
          accept: 'application/ld+json, application/json'
        }
      }
    )

    const { publicKey } = await keyRes.json()

    // Verify the signature
    const success = signature.verify(
      publicKey.publicKeyPem // The PEM string from the public key object
    )

    if (!success) {
      // TODO: Better error
      throw new Error(`Invalid HTTP signature for ${keyId}`)
    }

    const activity = request.body

    // TODO: Check blocklist and reject
    // TODO: Check allowlist and process requests automatically
    await store.forDomain(domain).inbox.add(activity)
  })

  // Deny a follow request/boost/etc
  // The ID is the URL encoded id from the inbox activity
  server.delete<{
    Params: {
      domain: string
      id: IdField
    }
  }>('/:domain/inbox/:id', async (request, reply) => {
    const { domain, id } = request.params
    await store.forDomain(domain).inbox.remove(id)
  })

  // Approve the item from the inbox
  server.post<{
    Params: {
      domain: string
      id: IdField
    }
  }>('/:domain/inbox/:id', async (request, reply) => {
    const { domain, id } = request.params
    // TODO: Handle the type of activity!
    await store.forDomain(domain).inbox.remove(id)
  })
}
