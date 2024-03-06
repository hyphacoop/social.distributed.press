import { nanoid } from 'nanoid'
import { ActorInfo } from '../schemas'
import ActivityPubSystem, { DEFAULT_PUBLIC_KEY_FIELD } from './apsystem'
import { generateKeypair } from 'http-signed-fetch'

export class Announcements {
  apsystem: ActivityPubSystem
  publicURL: string

  constructor (apsystem: ActivityPubSystem, publicURL: string) {
    this.apsystem = apsystem
    this.publicURL = publicURL
  }

  async init (): Promise<void> {
    const actorUrl = `${this.publicURL}/v1/announcements/`

    try {
      const prev = await this.apsystem.store.announcements.getInfo()
      if (prev.actorUrl !== actorUrl) {
        await this.apsystem.store.announcements.setInfo({
          ...prev,
          actorUrl
        })
      }
    } catch {
      const { privateKeyPem, publicKeyPem } = generateKeypair()
      await this.apsystem.store.announcements.setInfo({
        actorUrl,
        publicKeyId: `${actorUrl}#${DEFAULT_PUBLIC_KEY_FIELD}`,
        keypair: {
          privateKeyPem,
          publicKeyPem
        },
        announce: false
      })
    }
  }

  async announce (actor: string, info: ActorInfo): Promise<void> {
    const existedAlready = await this.apsystem.store.actorsDb.get(actor)

    if (existedAlready === undefined && info.announce) {
      const activity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Note',
        id: `${info.actorUrl}outbox/${nanoid()}`,
        actor: info.actorUrl,
        attributedTo: info.actorUrl,
        published: new Date().toUTCString(),
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: ['https://social.distributed.press/v1/announcements/followers'],
        // TODO: add a template in config
        content: `a wild site appears! ${actor}`
      }
      await this.apsystem.store.announcements.outbox.add(activity)
      await this.apsystem.notifyFollowers('announcements', activity)
    }
  }
}
