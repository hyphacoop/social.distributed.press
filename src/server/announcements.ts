import { nanoid } from 'nanoid'
import { ActorInfo } from '../schemas'
import ActivityPubSystem, { DEFAULT_PUBLIC_KEY_FIELD } from './apsystem'
import { generateKeypair } from 'http-signed-fetch'
import { APOrderedCollection } from 'activitypub-types'
import { ActorStore } from './store/ActorStore'

export class Announcements {
  apsystem: ActivityPubSystem
  publicURL: string

  constructor (apsystem: ActivityPubSystem, publicURL: string) {
    this.apsystem = apsystem
    this.publicURL = publicURL
  }

  get actorUrl (): string {
    return `${this.publicURL}/v1/${this.mention}/`
  }

  get outboxUrl (): string {
    return `${this.actorUrl}outbox`
  }

  get mention (): string {
    const url = new URL(this.publicURL)
    return `@announcements@${url.hostname}`
  }

  getActor (): ActorStore {
    return this.apsystem.store.forActor(this.mention)
  }

  async init (): Promise<void> {
    const actorUrl = this.actorUrl
    const actor = this.getActor()

    try {
      const prev = await actor.getInfo()
      if (prev.actorUrl !== actorUrl) {
        await actor.setInfo({
          ...prev,
          actorUrl
        })
      }
    } catch {
      const { privateKeyPem, publicKeyPem } = generateKeypair()
      await actor.setInfo({
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
    let existedAlready = false
    try {
      const existingActor = await this.apsystem.store.actorsDb.get(actor)
      if (existingActor === undefined) existedAlready = true
    } catch (err) {
      if (!(err as { notFound: boolean }).notFound) {
        throw err
      }
    }

    if (!existedAlready && info.announce) {
      const activity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Note',
        id: `${this.outboxUrl}/${nanoid()}`,
        actor: info.actorUrl,
        attributedTo: info.actorUrl,
        published: new Date().toUTCString(),
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [`${this.actorUrl}followers`],
        // TODO: add a template in config
        content: `a wild site appears! ${actor}`
      }
      await this.getActor().outbox.add(activity)
      await this.apsystem.notifyFollowers(this.mention, activity)
    }
  }

  async getOutbox (): Promise<APOrderedCollection> {
    const actor = this.getActor()
    const activities = await actor.outbox.list()
    const orderedItems = activities
      // XXX: maybe `new Date()` doesn't correctly parse possible dates?
      .map(a => ({ ...a, published: typeof a.published === 'string' ? new Date(a.published) : a.published }))
      .sort((a, b) => +(b.published ?? 0) - +(a.published ?? 0))
      .map(a => a.id)
      .filter((id): id is string => id !== undefined)

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${this.actorUrl}outbox`,
      type: 'OrderedCollection',
      totalItems: orderedItems.length,
      orderedItems
    }
  }
}
