import { APIConfig, FastifyTypebox } from '.'
import { Type } from '@sinclair/typebox'

import Store from '../store'

export const blockAllowListRoutes = (cfg: APIConfig, store: Store) => async (server: FastifyTypebox): Promise<void> => {
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
      description: 'Remove from allowlist, newline delimited body.',
      tags: ['Moderation']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    const accounts = request.body.accounts.split('\n')
    await store.forDomain(domain).allowlist.remove(accounts)
    return await reply.send({ message: 'Removed successfully' })
  })
}
