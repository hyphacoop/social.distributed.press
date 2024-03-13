import { nanoid } from 'nanoid'
import ActivityPubSystem, { DEFAULT_PUBLIC_KEY_FIELD } from './apsystem'
import { generateKeypair } from 'http-signed-fetch'
import { APOrderedCollection, APActor } from 'activitypub-types'
import { ActorStore } from './store/ActorStore'

export type APActorNonStandard = APActor & {
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
}

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

  get store (): ActorStore {
    return this.apsystem.store.forActor(this.mention)
  }

  async getActor (): Promise<APActorNonStandard> {
    const actorInfo = await this.store.getInfo()
    return {
      '@context': [
        // TODO: I copied this from Mastodon, is this correct?
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      // https://www.w3.org/TR/activitystreams-vocabulary/#actor-types
      id: this.actorUrl,
      type: 'Person',
      name: 'Announcements',
      summary: `Announcements for ${new URL(this.actorUrl).hostname}`,
      preferredUsername: 'announcements',
      following: `${actorInfo.actorUrl}following`,
      followers: `${actorInfo.actorUrl}followers`,
      inbox: `${actorInfo.actorUrl}inbox`,
      outbox: `${actorInfo.actorUrl}outbox`,
      publicKey: {
        id: `${actorInfo.actorUrl}#main-key`,

        owner: actorInfo.actorUrl,
        publicKeyPem: actorInfo.keypair.publicKeyPem
      }
    }
  }

  async init (): Promise<void> {
    const actorUrl = this.actorUrl
    const actor = this.store

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

  async announce (actor: string): Promise<void> {
    const actorUrl = await this.apsystem.mentionToActor(actor)
    const published = new Date().toUTCString()
    const to = ['https://www.w3.org/ns/activitystreams#Public']
    const cc = [`${this.actorUrl}followers`, actorUrl]

    const mentionText = `<span class="h-card"><a href="${actorUrl}" class="u-url mention">${actor}</a></span>`

    const note = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Note',
      id: `${this.outboxUrl}/${nanoid()}`,
      attributedTo: this.actorUrl,
      published,
      to,
      cc,
      // TODO: add a template in config
      content: `A wild ${mentionText} appears!`,
      tag: [{ type: 'Mention', href: actorUrl, name: actor }]
    }
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      id: `${this.outboxUrl}/${nanoid()}`,
      actor: this.actorUrl,
      published,
      to,
      cc,
      object: note
    }
    await this.store.outbox.add(activity)
    await this.store.outbox.add(note)
    await this.apsystem.notifyFollowers(this.mention, activity)
  }

  async getOutbox (): Promise<APOrderedCollection> {
    const actor = this.store
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
