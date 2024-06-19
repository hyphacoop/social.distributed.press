import { APIConfig, FastifyTypebox } from './index.js'
import ActivityPubSystem from '../apsystem.js'
import Store from '../store/index.js'

export const wellKnownRoutes = (cfg: APIConfig, store: Store, apsystem: ActivityPubSystem) => async (server: FastifyTypebox): Promise<void> => {
  server.get<{
    Reply: any
  }>('/.well-known/webfinger', {
    schema: {
      description: 'ActivityPub WebFinger',
      tags: ['ActivityPub']
    }
  }, async (request, reply) => {
    // https://docs.joinmastodon.org/spec/webfinger/
    return await reply
      .headers({
        'Content-Type': 'application/jrd+json'
      })
      .send({
        subject: `acct:${apsystem.announcements.mention.slice(1)}`,
        aliases: [apsystem.announcements.actorUrl],
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: apsystem.announcements.actorUrl
          }
        ]
      })
  })
}
