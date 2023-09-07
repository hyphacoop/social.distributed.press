import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, {
  FastifyBaseLogger,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  FastifyInstance
} from 'fastify'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import metrics from 'fastify-metrics'

import path from 'node:path'
import envPaths from 'env-paths'

import { Level } from 'level'
import { MemoryLevel } from 'memory-level'

import Store from '../store/index.js'
import ActivityPubSystem from '../apsystem.js'
import HookSystem from '../hooksystem.js'
import { ModerationChecker } from '../moderation.js'

import { ServerI } from '../index.js'

import { inboxRoutes } from './inbox.js'
import { outboxRoutes } from './outbox.js'
import { creationRoutes } from './creation.js'
import { blockAllowListRoutes } from './blockallowlist.js'
import { adminRoutes } from './admins.js'
import { followerRoutes } from './followers.js'
import { hookRoutes } from './hooks.js'

export const paths = envPaths('distributed-press')

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
}> & ServerI

async function apiBuilder (cfg: APIConfig): Promise<FastifyTypebox> {
  const basePath = cfg.storage ?? paths.data
  const cfgStoragePath = path.join(basePath, 'cfg')
  const db = cfg.useMemoryBackedDB === true
    ? new MemoryLevel({ valueEncoding: 'json' })
    : new Level(cfgStoragePath, { valueEncoding: 'json' })

  const server = fastify({
    logger: cfg.useLogging,
    trustProxy: true
  }).withTypeProvider<TypeBoxTypeProvider>()
  const store = new Store(db)
  const modCheck = new ModerationChecker(store)
  const hookSystem = new HookSystem(store)
  const apsystem = new ActivityPubSystem(cfg.publicURL, store, modCheck, hookSystem)

  const parser = server.getDefaultJsonParser('ignore', 'ignore')

  server.addContentTypeParser('text/json', { parseAs: 'string' }, parser)
  server.addContentTypeParser('application/ld+json', { parseAs: 'string' }, parser)
  server.addContentTypeParser('application/activity+json', { parseAs: 'string' }, parser)

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

  await server.register(v1Routes(cfg, store, apsystem, hookSystem), { prefix: '/v1' })

  await server.ready()

  server.log.info(cfg)
  return server
}

const v1Routes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem, hookSystem: HookSystem) => async (server: FastifyTypebox): Promise<void> => {
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
        }
      }
    })

    await server.register(swagger_ui, {
      routePrefix: '/docs'
    })
  }

  await server.register(creationRoutes(cfg, store))
  await server.register(inboxRoutes(cfg, store, apsystem))
  await server.register(outboxRoutes(cfg, store, apsystem))
  await server.register(followerRoutes(cfg, store, apsystem))
  await server.register(blockAllowListRoutes(cfg, store))
  await server.register(adminRoutes(cfg, store))
  await server.register(hookRoutes(cfg, store, hookSystem))

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
