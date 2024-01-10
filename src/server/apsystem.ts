import type { APActivity, APActor, APCollection } from 'activitypub-types'
import signatureParser from 'activitypub-http-signatures'
import * as httpDigest from '@digitalbazaar/http-digest-header'
import { nanoid } from 'nanoid'
import HookSystem from './hooksystem.js'
import { XMLParser } from 'fast-xml-parser'
import createError from 'http-errors'

import type { FastifyRequest } from 'fastify'
import {
  ModerationChecker,
  BLOCKED,
  ALLOWED
} from './moderation.js'

import type Store from './store/index.js'
import { makeSigner } from '../keypair.js'

export const DEFAULT_PUBLIC_KEY_FIELD = 'publicKey'

export interface BasicFetchParams {
  url: string
  method?: string
  headers: { [headerName: string]: string }
  body?: string
}

export interface HostMetaLink {
  rel: string
  template?: string
  href?: string
}

export interface HostMeta {
  XRD: {
    Link: HostMetaLink[]
  }
}

export type FetchLike = typeof globalThis.fetch

export default class ActivityPubSystem {
  publicURL: string
  store: Store
  modCheck: ModerationChecker
  fetch: FetchLike
  hookSystem: HookSystem

  constructor (
    publicURL: string,
    store: Store,
    modCheck: ModerationChecker,
    hookSystem: HookSystem,
    fetch: FetchLike = globalThis.fetch
  ) {
    this.publicURL = publicURL
    this.store = store
    this.modCheck = modCheck
    this.fetch = fetch
    this.hookSystem = hookSystem
  }

  makeURL (path: string): string {
    return this.publicURL + path
  }

  async hasPermissionActorRequest (forActor: string, request: FastifyRequest, signed: boolean = true): Promise<boolean> {
    const fromActor = signed ? forActor : undefined
    const resolvedActor = await this.verifySignedRequest(request, fromActor)

    if (resolvedActor === forActor) {
      return true
    }

    return await this.store.admins.matches(resolvedActor)
  }

  async hasAdminPermissionForRequest (request: FastifyRequest): Promise<boolean> {
    const resolvedActor = await this.verifySignedRequest(request)

    if (await this.store.blocklist.matches(resolvedActor)) {
      return false
    }
    return await this.store.admins.matches(resolvedActor)
  }

  async verifySignedRequest (request: FastifyRequest, fromActor?: string): Promise<string> {
  // TODO: Fetch and verify Digest header
    const { url, method, headers } = request
    const signature = signatureParser.parse({ url, method, headers })
    const { keyId } = signature

    // TODO: Look up key from key id somehow?
    const keyField = DEFAULT_PUBLIC_KEY_FIELD

    // Convert from actor URL to `@username@domain format
    const mention = await this.actorToMention(keyId, fromActor)

    const isAllowed = await this.modCheck.isAllowed(mention, fromActor)

    if (!isAllowed) {
      throw createError(403, `Blocked actor ${mention}`)
    }

    const actor: any = await this.getActor(keyId, fromActor)

    const publicKey = actor[keyField]
    if (publicKey?.publicKeyPem === undefined) {
      throw createError(404, `Unable to find public key at ${keyField} in ${keyId}`)
    }

    // Verify the signature
    const success = signature.verify(
      publicKey.publicKeyPem // The PEM string from the public key object
    )

    if (!success) {
      throw createError(401, `Invalid HTTP signature for ${keyId}`)
    }

    // TODO: Handle getting the actor from something other than the key id??
    const parsedActorURL = new URL(keyId)
    parsedActorURL.hash = ''

    const fullActorURL = parsedActorURL.href

    return await this.actorToMention(fullActorURL, fromActor)
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
    const url = await this.getInbox(actorURL, fromActor)

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
      throw createError(500, `Cannot fetch actor data for ${fromActor}: http status ${response.status} - ${await response.text()}`)
    }
  }

  async getActor (actorURL: string, fromActor?: string): Promise<APActor> {
    let response

    if (typeof fromActor === 'string' && fromActor.trim() !== '') {
      // Use signed fetch if fromActor is provided
      response = await this.signedFetch(fromActor, {
        url: actorURL,
        method: 'GET',
        headers: { Accept: 'application/ld+json' }
      })
    } else {
      // Use regular fetch if fromActor is not provided
      response = await this.fetch(actorURL, {
        headers: { Accept: 'application/ld+json' }
      })
    }

    // Check if response is not okay and throw an error
    if (!response.ok) {
      throw createError(500, `Cannot fetch actor data from ${actorURL}: http status ${response.status} - ${await response.text()}`)
    }

    try {
      // TODO: Verify structure?
      const actor = await response.json() as APActor
      return actor
    } catch (cause) {
      throw createError(422, `Unable to parse actor JSON at ${actorURL}`, { cause })
    }
  }

  async getInbox (actorURL: string, fromActor: string): Promise<string> {
    const actor = await this.getActor(actorURL, fromActor)
    // TODO do proper json-ld resolving
    return actor.inbox as string
    // get inbox url and return
  }

  // Turns urls like https://domain.com/example into @example@domain.com
  async actorToMention (actorURL: string, fromActor?: string): Promise<string> {
    let actor

    if (typeof fromActor === 'string' && fromActor.trim() !== '') {
      // Use signed fetch if fromActor is provided
      actor = await this.getActor(actorURL, fromActor)
    } else {
      // Use regular fetch if fromActor is not provided
      const response = await this.fetch(actorURL, {
        headers: { Accept: 'application/ld+json' }
      })

      if (!response.ok) {
        throw createError(500, `Cannot fetch actor data from ${actorURL}: http status ${response.status}`)
      }

      try {
        actor = await response.json() as APActor
      } catch (cause) {
        throw createError(422, `Unable to parse actor JSON at ${actorURL}`, { cause })
      }
    }

    const { preferredUsername } = actor
    if (preferredUsername === undefined) {
      throw createError(404, `Could not generate webmention name for actor at ${actorURL}, missing preferredUsername field`)
    }
    const domain = new URL(actorURL).host

    return `@${preferredUsername}@${domain}`
  }

  async mentionToActor (mention: string): Promise<string> {
    const { username, domain } = parseMention(mention)
    let webfingerURL = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`

    let response = await this.fetch(webfingerURL)

    if (!response.ok && response.status === 404) {
      const hostMetaURL = `https://${domain}/.well-known/host-meta`
      const hostMetaResponse = await this.signedFetch(this.publicURL, {
        url: hostMetaURL,
        method: 'GET',
        headers: {}
      })

      if (!hostMetaResponse.ok) {
        throw createError(404, `Cannot fetch host-meta data from ${hostMetaURL}: http status ${hostMetaResponse.status}`)
      }

      const hostMetaText = await hostMetaResponse.text()
      const parser = new XMLParser()
      const hostMeta: HostMeta = parser.parse(hostMetaText)

      const webfingerTemplate = hostMeta.XRD.Link.find((link: HostMetaLink) => link.rel === 'lrdd' && link.template)?.template

      if (typeof webfingerTemplate !== 'string' || webfingerTemplate.length === 0) {
        throw createError(404, `Webfinger template not found in host-meta data at ${hostMetaURL}`)
      }

      webfingerURL = webfingerTemplate.replace('{uri}', `acct:${username}@${domain}`)
      response = await this.fetch(webfingerURL)
    }

    if (!response.ok) {
      throw createError(404, `Cannot fetch webmention data from ${webfingerURL}: http status ${response.status}`)
    }

    const { subject, links } = await response.json()
    if (subject !== `acct:${username}@${domain}`) {
      throw createError(404, `Webmention endpoint returned invalid subject for ${webfingerURL}`)
    }

    const actorLink = links.find((link: HostMetaLink) => link.rel === 'self')
    if (typeof actorLink?.href !== 'string' || actorLink.href.trim().length === 0) {
      throw createError(404, `Unable to find actor link from webmention at ${webfingerURL}`)
    }

    return actorLink.href
  }

  async ingestActivity (fromActor: string, activity: APActivity): Promise<void> {
    const activityId = activity.id

    // TODO: handle array of string case and nested object
    if (typeof activityId !== 'string') {
      throw createError(400, 'Activities must contain an ID')
    }

    const activityActor = activity.actor

    // TODO: handle array of string case and nested object
    if (typeof activityActor !== 'string') {
      throw createError(400, 'Activities must contain an actor string')
    }

    const mention = await this.actorToMention(activityActor, fromActor)

    const moderationState = await this.modCheck.check(mention, fromActor)

    const actorStore = this.store.forActor(fromActor)
    // TODO: trigger hooks
    await actorStore.inbox.add(activity)

    if (moderationState === BLOCKED) {
      await this.rejectActivity(fromActor, activityId)
    } else if (moderationState === ALLOWED) {
      await this.approveActivity(fromActor, activityId)
    } else {
      await this.hookSystem.dispatchModerationQueued(fromActor, activity)
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
    await this.hookSystem.dispatchOnApproved(fromActor, activity)
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
    await this.hookSystem.dispatchOnRejected(fromActor, activity)
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

    const webmention = await this.actorToMention(followerURL, fromActor)

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

    const profile = await this.getActor(actorURL, fromActor)
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
