import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { APActivity } from 'activitypub-types'
import signatureParser from 'activitypub-http-signatures'
import fastify, {
  FastifyBaseLogger,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  FastifyInstance
} from 'fastify'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import metrics from 'fastify-metrics'

import path from 'node:path'
import envPaths from 'env-paths'

import { Level } from 'level'
import { MemoryLevel } from 'memory-level'

import Store from '../store/index.js'
import { ServerI } from '../index.js'

const paths = envPaths('distributed-press')

export type FastifyTypebox = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>

export type APIConfig = Partial<{
  useLogging: boolean
  useSwagger: boolean
  usePrometheus: boolean
  useMemoryBackedDB: boolean
  useSigIntHandler: boolean
  useWebringDirectoryListing: boolean
}> & ServerI

async function apiBuilder(cfg: APIConfig): Promise<FastifyTypebox> {
  const basePath = cfg.storage ?? paths.data
  const cfgStoragePath = path.join(basePath, 'cfg')
  const db = cfg.useMemoryBackedDB === true
    ? new MemoryLevel({ valueEncoding: 'json' })
    : new Level(cfgStoragePath, { valueEncoding: 'json' })

  const server = fastify({ logger: cfg.useLogging }).withTypeProvider<TypeBoxTypeProvider>()

  const store = new Store(cfg, db)

  await server.register(multipart)

  // handle cleanup on shutdown
  server.addHook('onClose', async server => {
    server.log.info('Begin shutdown')
    // TODO: Close the store
  })

  // catch SIGINTs
  if (cfg.useSigIntHandler === true) {
    process.on('SIGINT', () => {
      server.log.warn('Caught SIGINT')
      server.close(() => {
        process.exit()
      })
    })
  }

  server.get('/healthz', () => {
    return 'ok\n'
  })

  await server.register(v1Routes(cfg, store), { prefix: '/v1' })
  await server.ready()
  return server
}

const v1Routes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
  if (cfg.usePrometheus ?? false) {
    await server.register(metrics, { endpoint: '/metrics' })
  }

  if (cfg.useSwagger ?? false) {
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'Distributed Press Social Inbox',
          description: 'Documentation on how to use the Distributed Press Social Inbox Service API.',
          version: '1.0.0'
        },
        tags: [
          // { name: 'site', description: 'Managing site deployments' },
        ],
        components: {
          securitySchemes: {
            jwt: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'String containing the full JWT token'
            }
          }
        }
      }
    })

    await server.register(swagger_ui, {
      routePrefix: '/docs'
    })
  }

  // Get global list of blocked users/instances as newline delimited string
  server.get('/blocklist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/blocklist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/blocklist', async (request, reply) => { })

  // Get global list of auto-approved instances and users, newline delimited string
  server.get('/allowlist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/allowlist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/allowlist', async (request, reply) => { })

  // Create a new inbox
  // Should have auth from DP server?
  server.post('/:domain/', async (request, reply) => { })
  // Get info about the domain like the public key and configuration settings
  server.get('/:domain/', async (request, reply) => { })

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
      response: {
        200: Type.Any()
      },
      description: 'Items in the inbox queue.',
      tags: ['Publishers']
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
  }>('/:domain/inbox', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'ActivityPub inbox for your domain.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const { url, method, headers } = request
    const signature = signatureParser.parse({ url, method, headers })
    const { keyId } = signature.keyId
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

    if (success !== true) {
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
  server.delete('/:domain/inbox/:id', async (request, reply) => {
    const { domain, id } = request.params
    await store.forDomain(domain).inbox.remove(id)
  })
  // Approve the item from the inbox
  server.post('/:domain/inbox/:id', async (request, reply) => {
    const { domain, id } = request.params
    // TODO: Handle the type of activity!
    await store.forDomain(domain).inbox.remove(id)
  })

  // Get list of blocked users/instances as newline delimited string
  server.get('/:domain/blocklist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/:domain/blocklist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/:domain/blocklist', async (request, reply) => { })

  // Get list of auto-approved instances and users, newline delimited string
  server.get('/:domain/allowlist', async (request, reply) => { })
  // Add to the list, newline delimted list in body
  server.post('/:domain/allowlist', async (request, reply) => { })
  // Remove from list, newline delimited body
  server.delete('/:domain/allowlist', async (request, reply) => { })

  // Get list of followers as JSON-LD
  server.get('/:domain/followers', async (request, reply) => { })
  // Remove a follower (notifying their server), use URL encoded URL of follower Actor
  server.delete('/:domain/followers/:follower', async (request, reply) => { })

  // Register hooks for new inbox items that get added to the moderation queue
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onmoderationqueued', async (request, reply) => { })
  server.delete('/:domain/hooks/onmoderationqueued', async (request, reply) => { })
  server.put('/:domain/hooks/onmoderationqueued', async (request, reply) => { })

  // Register hooks for new inbox items that get approved
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onnew', async (request, reply) => { })
  server.delete('/:domain/hooks/onnew', async (request, reply) => { })
  server.put('/:domain/hooks/onnew', async (request, reply) => { })

  // Register hooks for new inbox items that get rejected
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onrejected', async (request, reply) => { })
  server.delete('/:domain/hooks/onrejected', async (request, reply) => { })
  server.put('/:domain/hooks/onrejected', async (request, reply) => { })

  // Register Routes
  // await server.register(authRoutes(cfg, store))

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
