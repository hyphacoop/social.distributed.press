import type { APActivity, APActor, APCollection } from 'activitypub-types'
import signatureParser from 'activitypub-http-signatures'
import * as httpDigest from '@digitalbazaar/http-digest-header'
import { nanoid } from 'nanoid'

import type { FastifyRequest } from 'fastify'
import {
  ModerationChecker,
  BLOCKED,
  ALLOWED
} from './moderation.js'

import type Store from '../store/index.js'
import { makeSigner } from '../keypair'

export const DEFAULT_PUBLIC_KEY_FIELD = 'publicKey'

export interface BasicFetchParams {
  url: string
  method?: string
  headers: { [headerName: string]: string }
  body?: string
}

export type FetchLike = typeof globalThis.fetch

export default class ActivityPubSystem {
  publicURL: string
  store: Store
  modCheck: ModerationChecker
  fetch: FetchLike

  constructor (publicURL: string, store: Store, modCheck: ModerationChecker, fetch: FetchLike = globalThis.fetch) {
    this.publicURL = publicURL
    this.store = store
    this.modCheck = modCheck
    this.fetch = fetch
  }

  makeURL (path: string): string {
    return this.publicURL + path
  }

  async verifySignedRequest (fromActor: string, request: FastifyRequest): Promise<string> {
  // TODO: Fetch and verify Digest header
    const { url, method, headers } = request
    const signature = signatureParser.parse({ url, method, headers })
    const { keyId } = signature

    // TODO: Look up key from key id somehow?
    const keyField = DEFAULT_PUBLIC_KEY_FIELD

    // Convert from actor URL to `@username@domain format
    const mention = await this.actorToMention(keyId)

    const isAllowed = await this.modCheck.isAllowed(mention, fromActor)

    if (!isAllowed) {
    // TODO: HTTP status code 409?
      throw new Error(`Blocked actor ${mention}`)
    }

    const actor: any = await this.getActor(keyId)

    const publicKey = actor[keyField]
    if (publicKey?.publicKeyPem === undefined) {
      throw new Error(`Unable to find public key at ${keyField} in ${keyId}`)
    }

    // Verify the signature
    const success = signature.verify(
      publicKey.publicKeyPem // The PEM string from the public key object
    )

    if (!success) {
      // TODO: Better error
      throw new Error(`Invalid HTTP signature for ${keyId}`)
    }

    return keyId
  }

  async signedFetch (fromActor: string, request: BasicFetchParams): Promise<Response> {
    const fromActorURL = await this.mentionToActor(fromActor)
    // get actor keypair from store
    const { keypair } = await this.store.forActor(fromActor).getInfo()
    const publicKeyId = `${fromActorURL}#${DEFAULT_PUBLIC_KEY_FIELD}`

    // set up signed header from url/method/etc
    const {
      url,
      method,
      headers: initialHeaders,
      body
    } = request

    const digest = await httpDigest
      .createHeaderValue({
        data: body ?? '',
        algorithm: 'sha256',
        useMultihash: false
      })

    const headers = {
      ...initialHeaders,
      host: new URL(url).host,
      date: new Date().toUTCString(),
      digest
    }

    // Sign data
    const signer = makeSigner(keypair, publicKeyId, ['(request-target)', 'host', 'date', 'digest'])
    const signature = signer.sign({
      url,
      method,
      headers
    })

    // Add signature to headers and fetch
    return await this.fetch(url, {
      method,
      body,
      headers: new Headers({
        ...headers,
        signature,
        accept: 'application/ld+json'
      })
    })
  }

  async sendTo (actorURL: string, fromActor: string, activity: APActivity): Promise<void> {
    const method = 'post'
    const url = await this.getInbox(actorURL)

    // resolve actor data
    // get their inbox url
    // send a signed fetch POST with the activity
    const response = await this.signedFetch(fromActor, {
      url,
      method,
      body: JSON.stringify(activity),
      headers: {
        'Content-Type': 'application/ld+json'
      }
    })

    // Check if response has error and throw one if so
    if (!response.ok) {
      throw new Error(`Cannot fetch actor data: http status ${response.status} - ${await response.text()}`)
    }
  }

  async getActor (actorURL: string): Promise<APActor> {
  // resolve actor data with fetch
    const response = await this.fetch(actorURL, {
      headers: {
        Accept: 'application/ld+json'
      }
    })

    // throq if response not ok or if inbox isn't a string
    if (!response.ok) {
      throw new Error(`Cannot fetch actor data: http status ${response.status} - ${await response.text()}`)
    }

    // TODO: Support html pages with a link rel in them

    // TODO: Verify structure?
    const actor = (await response.json()) as APActor

    return actor
  }

  async getInbox (actorURL: string): Promise<string> {
    const actor = await this.getActor(actorURL)
    // TODO do proper json-ld resolving
    return actor.inbox as string
    // get inbox url and return
  }

  // Turns urls like https://domain.com/example into @example@domain.com
  async actorToMention (actorURL: string): Promise<string> {
    const actor = await this.getActor(actorURL)
    const { preferredUsername } = actor

    if (preferredUsername === undefined) {
      throw new Error('Could not generate webmention name for actor, missing preferredUsername field')
    }
    const domain = new URL(actorURL).host

    return `@${preferredUsername}@${domain}`
  }

  async mentionToActor (mention: string): Promise<string> {
    const { username, domain } = parseMention(mention)
    const acct = `acct:${username}@${domain}`
    // TODO: dynamically determine the parameter name from the host-meta file
    const mentionURL = `https://${domain}/.well-known/webfinger?resource=${acct}`

    const response = await this.fetch(mentionURL)

    // throq if response not ok or if inbox isn't a string
    if (!response.ok) {
      throw new Error(`Cannot fetch webmention data from ${mentionURL}: http status ${response.status} - ${await response.text()}`)
    }

    const { subject, links } = await response.json()
    if (subject !== acct) {
      throw new Error(`Webmention endpoint returned invalid subject. Extepcted ${acct} at ${mentionURL}, got ${subject as string}`)
    }

    if (!Array.isArray(links)) {
      throw new Error(`Expected links array in webmention endpoint for ${mentionURL}`)
    }

    for (const { rel, type, href } of links) {
      if (rel !== 'self') continue
      if ((type !== 'application/activity+json') && (type !== 'application/ld+json')) continue
      return href
    }

    throw new Error('Unable to find ActivityPub link from webmentions')
  }

  async ingestActivity (fromActor: string, activity: APActivity): Promise<void> {
    const activityId = activity.id

    // TODO: handle array of string case and nested object
    if (typeof activityId !== 'string') {
      throw new Error('Activities must contain an ID')
    }

    const activityActor = activity.actor

    // TODO: handle array of string case and nested object
    if (typeof activityActor !== 'string') {
      throw new Error('Activities must contain an actor string')
    }

    const mention = await this.actorToMention(activityActor)

    const moderationState = await this.modCheck.check(mention, fromActor)

    const actorStore = this.store.forActor(fromActor)
    // TODO: trigger hooks
    await actorStore.inbox.add(activity)

    if (moderationState === BLOCKED) {
      await this.rejectActivity(fromActor, activityId)
    } else if (moderationState === ALLOWED) {
      await this.approveActivity(fromActor, activityId)
    } else {
      // TODO: trigger hook
    }
  }

  async approveActivity (fromActor: string, activityId: string): Promise<void> {
    const actorStore = this.store.forActor(fromActor)
    const activity = await actorStore.inbox.get(activityId)

    const { type } = activity

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      await this.acceptFollow(fromActor, activity)
    }
    await actorStore.inbox.remove(activityId)
  }

  async rejectActivity (fromActor: string, activityId: string): Promise<void> {
    const actorStore = this.store.forActor(fromActor)
    const activity = await actorStore.inbox.get(activityId)

    const { type } = activity

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      await this.acceptFollow(fromActor, activity)
    }
    await actorStore.inbox.remove(activityId)
  }

  async notifyFollowers (fromActor: string, activity: APActivity): Promise<void> {
    // get followers list from store
    const followers = await this.store.forActor(fromActor).followers.list()
    // loop through each
    await Promise.all(followers.map(async (mention) => {
      const actorURL = await this.mentionToActor(mention)
      return await this.sendTo(actorURL, fromActor, activity)
    }))
  }

  async removeFollower (fromActor: string, followerMention: string): Promise<void> {
    await this.store.forActor(fromActor).followers.remove([followerMention])
  }

  async acceptFollow (fromActor: string, followActivity: APActivity): Promise<void> {
    const fromActorURL = await this.mentionToActor(fromActor)
    const followerURL = followActivity.actor as string
    const id = this.makeURL(`/v1/${fromActor}/outbox/${nanoid()}`)

    const response = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      // TODO: Resolve domain into actor?
      type: 'Accept',
      id,
      to: followerURL,
      actor: fromActorURL,
      object: followActivity
    }
    await this.store.forActor(fromActor).outbox.add(response)

    await this.sendTo(followerURL, fromActor, response)

    const webmention = await this.actorToMention(followerURL)

    await this.store.forActor(fromActor).followers.add([webmention])
  }

  async rejectFollow (fromActor: string, followActivity: APActivity): Promise<void> {
    const fromActorURL = await this.mentionToActor(fromActor)
    const followerURL = followActivity.actor as string
    const id = this.makeURL(`/v1/${fromActor}/outbox/${nanoid()}`)

    const response = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      // TODO: Resolve domain into actor?
      type: 'Reject',
      id,
      to: followerURL,
      actor: fromActorURL,
      object: followActivity
    }
    await this.store.forActor(fromActor).outbox.add(response)
    await this.sendTo(followerURL, fromActor, response)
  }

  async followersCollection (fromActor: string): Promise<APCollection> {
    const actorStore = this.store.forActor(fromActor)
    const actorURL = await this.mentionToActor(fromActor)

    const profile = await this.getActor(actorURL)
    let followersURL = profile.followers
    // TODO: handle array of string?
    if (typeof followersURL !== 'string') {
      followersURL = actorURL + '#followers'
    }

    const followers = await actorStore.followers.list()

    const items = await Promise.all(
      followers.map(async (mention) => await this.mentionToActor(mention))
    )

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: followersURL,
      items,
      totalItems: items.length
    }
  }

  async getOutboxItem (fromActor: string, id: string): Promise<APActivity> {
    const apId = this.makeURL(`/v1/${fromActor}/outbox/${id}`)

    return await this.store.forActor(fromActor).outbox.get(apId)
  }
}

export function makeActivity (type: string, id: string, actor: string, object: any): APActivity {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id,
    type,
    actor,
    object
  }
}

export interface MentionParts {
  username: string
  domain: string
}

export function parseMention (mention: string): MentionParts {
// parse out domain
  const sections = mention.split('@')
  const username = sections[1]
  const domain = sections[2]

  return { username, domain }
}
