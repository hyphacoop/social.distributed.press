import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type, Static } from '@sinclair/typebox'

import { APActivity } from 'activitypub-types'

import signatureParser, { Sha256Signer } from 'activitypub-http-signatures'

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

async function apiBuilder (cfg: APIConfig): Promise<FastifyTypebox> {
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
  server.get('/blocklist', {
    schema: {
      response: {
        200: Type.String()
      },
      description: 'Get global list of blocked users/instances as newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const blockedAccounts = await store.blocklist.list()
    return await reply.type('text/plain').send(blockedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Body: {
      accounts: string
    }
  }>('/blocklist', {
    schema: {
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Add accounts to the global blocklist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const accounts = request.body.accounts.split('\n')
    await store.blocklist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Body: {
      accounts: string
    }
  }>('/blocklist', {
    schema: {
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Remove accounts to the global blocklist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const accounts = request.body.accounts.split('\n')
    await store.blocklist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Get global list of auto-approved instances and users, newline delimited string
  server.get('/allowlist', {
    schema: {
      response: {
        200: Type.String()
      },
      description: 'Get global list of auto-approved instances and users, newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const allowedAccounts = await store.allowlist.list()
    return await reply.type('text/plain').send(allowedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Body: {
      accounts: string
    }
  }>('/allowlist', {
    schema: {
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Add accounts to the global allowlist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const accounts = request.body.accounts.split('\n')
    await store.allowlist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Body: {
      accounts: string
    }
  }>('/allowlist', {
    schema: {
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Remove accounts to the global allowlist using newline delimited format.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const accounts = request.body.accounts.split('\n')
    await store.allowlist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Create a new inbox
  // Should have auth from DP server?
  server.post('/:domain/', async (request, reply) => {})
  // Get info about the domain like the public key and configuration settings
  server.get('/:domain/', async (request, reply) => {})

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
  server.delete<{
    Params: {
      domain: string
      id: string
    }
  }>('/:domain/inbox:id', {
    schema: {
      params: Type.Object({
        domain: Type.String(),
        id: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Delete a specific id from the inbox of the specified domain.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { domain, id } = request.params
    await store.forDomain(domain).inbox.remove(id)
  })
  // Approve the item from the inbox
  server.post<{
    Params: {
      domain: string
      id: string
    }
  }>('/:domain/inbox:id', {
    schema: {
      params: Type.Object({
        domain: Type.String(),
        id: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Approve a specific id from the inbox of the specified domain.',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    const { domain, id } = request.params
    // TODO: Handle the type of activity!
    await store.forDomain(domain).inbox.add(id)
  })

  // Get list of blocked users/instances as newline delimited string
  server.get<{
    Params: {
      domain: string
    }
  }>('/:domain/blocklist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Get list of blocked users/instances for a domain as newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const blockedAccounts = await store.forDomain(domain).blocklist.list()
    return await reply.type('text/plain').send(blockedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Params: {
      domain: string
    }
    Body: {
      accounts: string
    }
  }>('/:domain/blocklist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Add to the blocklist for a domain. Takes newline delimited list in body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const accounts = request.body.accounts.split('\n')
    await store.forDomain(domain).blocklist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Params: {
      domain: string
    }
    Body: {
      accounts: string
    }
  }>('/:domain/blocklist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Remove from list, newline delimited body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const accounts = request.body.accounts.split('\n')
    await store.forDomain(domain).blocklist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Get list of auto-approved instances and users, newline delimited string
  server.get<{
    Params: {
      domain: string
    }
  }>('/:domain/allowlist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Get list of auto-approved instances and users, newline delimited string.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const allowedAccounts = await store.forDomain(domain).allowlist.list()
    return await reply.type('text/plain').send(allowedAccounts.join('\n'))
  })

  // Add to the list, newline delimted list in body
  server.post<{
    Params: {
      domain: string
    }
    Body: {
      accounts: string
    }
  }>('/:domain/allowlist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Add to the allowlist, newline delimted list in body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const accounts = request.body.accounts.split('\n')
    await store.forDomain(domain).allowlist.add(accounts)
    return await reply.send({ message: 'Added successfully' })
  })

  // Remove from list, newline delimited body
  server.delete<{
    Params: {
      domain: string
    }
    Body: {
      accounts: string
    }
  }>('/:domain/blocklist', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      body: Type.Object({
        accounts: Type.String()
      }),
      response: {
        200: Type.String()
      },
      description: 'Remove from allowlist, newline delimited body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const accounts = request.body.accounts.split('\n')
    await store.forDomain(domain).allowlist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })

  // Get list of followers as JSON-LD
  server.get('/:domain/followers', async (request, reply) => {})
  // Remove a follower (notifying their server), use URL encoded URL of follower Actor
  server.delete('/:domain/followers/:follower', async (request, reply) => {})

  // Register hooks for new inbox items that get added to the moderation queue
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onmoderationqueued', async (request, reply) => {})
  server.delete('/:domain/hooks/onmoderationqueued', async (request, reply) => {})
  server.put('/:domain/hooks/onmoderationqueued', async (request, reply) => {})

  // Register hooks for new inbox items that get approved
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onnew', async (request, reply) => {})
  server.delete('/:domain/hooks/onnew', async (request, reply) => {})
  server.put('/:domain/hooks/onnew', async (request, reply) => {})

  // Register hooks for new inbox items that get rejected
  // Hooks are an array of {url, method, headers}
  // The body will contain the inbox item
  server.get('/:domain/hooks/onrejected', async (request, reply) => {})
  server.delete('/:domain/hooks/onrejected', async (request, reply) => {})
  server.put('/:domain/hooks/onrejected', async (request, reply) => {})

  // Register Routes
  // await server.register(authRoutes(cfg, store))

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
