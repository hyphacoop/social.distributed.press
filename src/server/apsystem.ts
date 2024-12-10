import type {
  APActivity,
  APActor,
  APCollection,
  APCollectionPage,
  APObject,
  APOrderedCollection,
  APOrderedCollectionPage,
  ObjectField
} from 'activitypub-types'
import signatureParser from 'activitypub-http-signatures'
import * as httpDigest from '@digitalbazaar/http-digest-header'
import { nanoid } from 'nanoid'
import HookSystem from './hooksystem.js'
import { XMLParser } from 'fast-xml-parser'
import createError from 'http-errors'

import type { FastifyRequest, FastifyBaseLogger } from 'fastify'
import { ModerationChecker, BLOCKED, ALLOWED } from './moderation.js'

import type Store from './store/index.js'
import { makeSigner } from '../keypair.js'
import { Announcements } from './announcements.js'

export const DEFAULT_PUBLIC_KEY_FIELD = 'publicKey'

type SomeSortOfCollection =
  | APOrderedCollection
  | APCollection
  | APOrderedCollectionPage
  | APCollectionPage

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
  log: FastifyBaseLogger
  announcements: Announcements

  constructor (
    publicURL: string,
    store: Store,
    modCheck: ModerationChecker,
    hookSystem: HookSystem,
    log: FastifyBaseLogger,
    fetch: FetchLike = globalThis.fetch
  ) {
    this.publicURL = publicURL
    this.store = store
    this.modCheck = modCheck
    this.fetch = fetch
    this.hookSystem = hookSystem
    this.log = log
    this.announcements = new Announcements(this, publicURL)
  }

  makeURL (path: string): string {
    return this.publicURL + path
  }

  async hasPermissionActorRequest (
    forActor: string,
    request: FastifyRequest,
    signed: boolean = true
  ): Promise<boolean> {
    const fromActor = signed ? forActor : undefined
    const resolvedActor = await this.verifySignedRequest(request, fromActor)

    if (resolvedActor === forActor) {
      return true
    }

    return await this.store.admins.matches(resolvedActor)
  }

  async hasAdminPermissionForRequest (
    request: FastifyRequest
  ): Promise<boolean> {
    const resolvedActor = await this.verifySignedRequest(request)

    if (await this.store.blocklist.matches(resolvedActor)) {
      return false
    }
    return await this.store.admins.matches(resolvedActor)
  }

  async verifySignedRequest (
    request: FastifyRequest,
    fromActor?: string
  ): Promise<string> {
    // TODO: Fetch and verify Digest header
    const { url, method, headers } = request

    if (headers.signature === undefined) {
      throw createError(401, 'Request is missing signature header', {
        fromActor,
        url,
        method
      })
    }

    // Fix for cosocial
    if (typeof headers.signature === 'string' && headers.signature.includes('hs2019')) {
      headers.signature = headers.signature.replace('hs2019', 'rsa-sha256')
    }

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
      throw createError(
        404,
        `Unable to find public key at ${keyField} in ${keyId}`
      )
    }

    // Verify the signature
    const success = signature.verify(
      publicKey.publicKeyPem // The PEM string from the public key object
    )

    this.log.debug({ url: request.url }, 'Verifying signed request')

    if (!success) {
      this.log.error({ actorURL: keyId }, 'Failed to verify HTTP signature')
      throw createError(401, `Invalid HTTP signature for ${keyId}`)
    }

    this.log.info({ actorURL: keyId }, 'Successfully verified HTTP signature')

    // TODO: Handle getting the actor from something other than the key id??
    const parsedActorURL = new URL(keyId)
    parsedActorURL.hash = ''

    const fullActorURL = parsedActorURL.href

    return await this.actorToMention(fullActorURL, fromActor)
  }

  async signedFetch (
    fromActor: string,
    request: BasicFetchParams
  ): Promise<Response> {
    const fromActorURL = await this.mentionToActor(fromActor)
    // get actor keypair from store
    const { keypair } = await this.store.forActor(fromActor).getInfo()
    const publicKeyId = `${fromActorURL}#${DEFAULT_PUBLIC_KEY_FIELD}`

    // set up signed header from url/method/etc
    const { url, method, headers: initialHeaders, body } = request

    const digest = await httpDigest.createHeaderValue({
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
    const signer = makeSigner(keypair, publicKeyId, [
      '(request-target)',
      'host',
      'date',
      'digest'
    ])
    const signature = signer.sign({
      url,
      method,
      headers
    })

    // Add signature to headers and fetch
    return await this.fetch(url, {
      method,
      body,
      signal: AbortSignal.timeout(3000),
      headers: new Headers({
        ...headers,
        signature,
        accept: 'application/ld+json'
      })
    })
  }

  async get (fromActor: string, urlOrObject: ObjectField): Promise<APObject> {
    if (typeof urlOrObject === 'string') {
      const response = await this.signedFetch(fromActor, {
        method: 'GET',
        url: urlOrObject,
        headers: {}
      })
      if (!response.ok) {
        throw createError(
          500,
          `Cannot fetch data for ${fromActor} at ${urlOrObject}: http status ${response.status} - ${await response.text()}`
        )
      }

      return await response.json()
    } else {
      return urlOrObject
    }
  }

  async * getAll (
    fromActor: string,
    items: ObjectField[]
  ): AsyncIterableIterator<APObject> {
    for (const itemOrUrl of items) {
      const item = await this.get(fromActor, itemOrUrl)

      yield item
    }
  }

  async * iterateCollection (
    fromActor: string,
    collectionOrUrl: ObjectField,
    { sort = 1 } = {}
  ): AsyncIterableIterator<APObject> {
    const collection = (await this.get(fromActor, collectionOrUrl)) as
      | APCollection
      | APOrderedCollection
    let items: ObjectField[] = collectionItems(collection)

    let next, prev

    if (sort === -1) {
      items = items.reverse()
      prev = collection.last // Start from the last page if sorting in descending order
    } else {
      next = collection.first // Start from the first page if sorting in ascending order
    }
    if (items.length !== 0) {
      for await (const item of this.getAll(fromActor, items)) {
        yield item
      }
    }

    // Iterate through pages in the specified order
    while ((sort === -1 ? prev : next) !== undefined) {
      const page = (await this.get(
        fromActor,
        (sort === -1 ? prev : next) as string
      )) as APOrderedCollectionPage | APCollectionPage
      next = page.next
      prev = page.prev
      items = collectionItems(collection)

      if (items.length === 0) {
        return
      }

      if (sort === -1) {
        items = items.reverse()
      }

      for await (const item of this.getAll(fromActor, items)) {
        yield item
      }
    }
  }

  async sendTo (
    actorURL: string,
    fromActor: string,
    activity: APActivity
  ): Promise<void> {
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
      throw createError(
        500,
        `Cannot fetch actor data for ${fromActor}: http status ${response.status} - ${await response.text()}`
      )
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
        signal: AbortSignal.timeout(3000),
        headers: { Accept: 'application/ld+json' }
      })
    }

    // Check if response is not okay and throw an error
    if (!response.ok) {
      throw createError(
        500,
        `Cannot fetch actor data from ${actorURL}: http status ${response.status} - ${await response.text()}`
      )
    }

    try {
      // TODO: Verify structure?
      const actor = (await response.json()) as APActor
      return actor
    } catch (cause) {
      throw createError(422, `Unable to parse actor JSON at ${actorURL}`, {
        cause
      })
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
        signal: AbortSignal.timeout(3000),
        headers: { Accept: 'application/ld+json' }
      })

      if (!response.ok) {
        throw createError(
          500,
          `Cannot fetch actor data from ${actorURL}: http status ${response.status}`
        )
      }

      try {
        actor = (await response.json()) as APActor
      } catch (cause) {
        throw createError(422, `Unable to parse actor JSON at ${actorURL}`, {
          cause
        })
      }
    }

    const { preferredUsername } = actor
    if (preferredUsername === undefined) {
      throw createError(
        404,
        `Could not generate webmention name for actor at ${actorURL}, missing preferredUsername field`
      )
    }
    const domain = new URL(actorURL).host

    return `@${preferredUsername}@${domain}`
  }

  async mentionToActor (mention: string): Promise<string> {
    const { username, domain } = parseMention(mention)
    let webfingerURL = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`

    let response = await this.fetch(webfingerURL, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok && response.status === 404) {
      const hostMetaURL = `https://${domain}/.well-known/host-meta`
      const hostMetaResponse = await this.signedFetch(this.publicURL, {
        url: hostMetaURL,
        method: 'GET',
        headers: {}
      })

      if (!hostMetaResponse.ok) {
        throw createError(
          404,
          `Cannot fetch host-meta data from ${hostMetaURL}: http status ${hostMetaResponse.status}`
        )
      }

      const hostMetaText = await hostMetaResponse.text()
      const parser = new XMLParser()
      const hostMeta: HostMeta = parser.parse(hostMetaText)

      const webfingerTemplate = hostMeta.XRD.Link.find(
        (link: HostMetaLink) => link.rel === 'lrdd' && link.template
      )?.template

      if (
        typeof webfingerTemplate !== 'string' ||
        webfingerTemplate.length === 0
      ) {
        throw createError(
          404,
          `Webfinger template not found in host-meta data at ${hostMetaURL}`
        )
      }

      webfingerURL = webfingerTemplate.replace(
        '{uri}',
        `acct:${username}@${domain}`
      )
      response = await this.fetch(webfingerURL, {
        signal: AbortSignal.timeout(3000)
      })
    }

    if (!response.ok) {
      throw createError(
        404,
        `Cannot fetch webmention data from ${webfingerURL}: http status ${response.status}`
      )
    }

    const { subject, links } = await response.json()
    if (subject !== `acct:${username}@${domain}`) {
      throw createError(
        404,
        `Webmention endpoint returned invalid subject for ${webfingerURL}`
      )
    }

    const actorLink = links.find((link: HostMetaLink) => link.rel === 'self')
    if (
      typeof actorLink?.href !== 'string' ||
      actorLink.href.trim().length === 0
    ) {
      throw createError(
        404,
        `Unable to find actor link from webmention at ${webfingerURL}`
      )
    }

    return actorLink.href
  }

  async ingestActivity (fromActor: string, activity: APActivity): Promise<void> {
    this.log.info(
      { type: activity.type, fromActor, id: activity.id },
      'Ingesting activity'
    )

    const activityId = activity.id

    // TODO: handle array of string case and nested object
    if (typeof activityId !== 'string') {
      throw createError(400, 'Activities must contain an ID')
    }

    const activityActor = activity.actor
    const activityType = activity.type

    // TODO: handle array of string case and nested object
    if (typeof activityActor !== 'string') {
      throw createError(400, 'Activities must contain an actor string')
    }

    const mention = await this.actorToMention(activityActor, fromActor)

    const moderationState = await this.modCheck.check(mention, fromActor)

    const actorStore = this.store.forActor(fromActor)

    const { manuallyApprovesFollowers } = await actorStore.getInfo()

    const autoApproveFollow =
      manuallyApprovesFollowers !== undefined && !manuallyApprovesFollowers

    if (activityType === 'Delete') {
      if (!(await actorStore.inbox.hasPostsFrom(activityActor))) {
        this.log.warn(
          { fromActor, activityId, activityActor },
          'Ignoring Delete of unknown actor'
        )
        return
      }
      // Remove activity from inbox and any other index/collection
      if (typeof activity.object !== 'string') {
        throw createError(400, 'Error deleting activity, must have activity URL in object field')
      }
      await actorStore.inbox.remove(activity.object)
      this.log.info({ activityId }, 'Deleted activity from inbox')
      // Notify CMS that the activity was deleted
      await this.hookSystem.dispatchOnApproved(fromActor, activity)
      return
    }
    await actorStore.inbox.add(activity)

    if (
      activityType === 'Follow' &&
      autoApproveFollow &&
      moderationState !== BLOCKED
    ) {
      this.log.info(
        { fromActor, target: activity.object },
        'Auto-approving follow request'
      )
      await this.approveActivity(fromActor, activityId)
    } else if (activityType === 'Undo') {
      await this.performUndo(fromActor, activity)
    } else if (moderationState === BLOCKED) {
      this.log.warn(
        { activityId: activity.id },
        'Blocking activity due to moderation settings'
      )
      // TODO: Notify of blocks?
      await this.rejectActivity(fromActor, activityId)
    } else if (moderationState === ALLOWED) {
      this.log.info(
        { activityId: activity.id },
        'Allowing activity through moderation'
      )
      await this.approveActivity(fromActor, activityId)
    } else {
      this.log.info(
        { activityId: activity.id },
        'Queueing activity for manual moderation'
      )
      await this.hookSystem.dispatchModerationQueued(fromActor, activity)
    }
  }

  async approveActivity (fromActor: string, activityId: string): Promise<void> {
    const actorStore = this.store.forActor(fromActor)
    const activity = await actorStore.inbox.get(activityId)

    const { type } = activity

    this.log.info(
      { fromActor, activityId, type: activity.type },
      'Approving activity'
    )

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      this.log.debug(
        { fromActor, target: activity.actor },
        'Processing follow activity'
      )
      await this.acceptFollow(fromActor, activity)
      await this.hookSystem.dispatchOnApproved(fromActor, activity)
    } else if (type === 'Undo') {
      await this.performUndo(fromActor, activity)
    } else if (type === 'Create' || type === 'Update') {
      if (typeof activity.object === 'string') {
        const response = await this.signedFetch(fromActor, {
          method: 'get',
          url: activity.object,
          headers: {
            'Content-Type': 'application/ld+json'
          }
        })

        if (!response.ok) {
          throw createError(
            404,
            `Unable to load object for activity at ${activity.object}`
          )
        }

        const object = await response.json()
        // We check that the activity actor is set elsewhere
        await this.storeObject(fromActor, object, activity.actor as string)
      } else if (typeof activity.object === 'object') {
        // TODO: Account for arrays
        await this.storeObject(
          fromActor,
          activity.object as APObject,
          activity.actor as string
        )
      } else {
        throw new Error(`Unable to load activity object for ${activityId}.`)
      }

      // All other items just get approved in the inbox
      await this.hookSystem.dispatchOnApproved(fromActor, activity)
    }

    if (activity.actor !== undefined && typeof activity.actor === 'string') {
      const interactedActorMention = await this.actorToMention(
        activity.actor,
        fromActor
      )
      await actorStore.interacted.add([interactedActorMention])
    }
  }

  async storeObject (
    fromActor: string,
    object: APObject,
    attributedTo: string = ''
  ): Promise<void> {
    if (attributedTo.length !== 0 && object.attributedTo !== attributedTo) {
      // TODO Shuld this be a different error? Should we just skip?
      throw createError(
        419,
        `Unexpected author for object in activity. Expected ${attributedTo}, got ${object.attributedTo as string}. In object at ${object.id as string}`
      )
    }
    const actorStore = this.store.forActor(fromActor)
    await actorStore.inboxObjects.add(object)
  }

  async backfillOutbox (fromActor: string, toActor: string): Promise<void> {
    const actorURL = await this.mentionToActor(fromActor)
    const actor = await this.getActor(actorURL, fromActor)

    const { outbox, id } = actor

    for await (const activity of this.iterateCollection(fromActor, outbox)) {
      await this.sendTo(id as string, fromActor, activity)
    }
  }

  async rejectActivity (fromActor: string, activityId: string): Promise<void> {
    this.log.warn(`Rejecting activity ${activityId} for actor ${fromActor}`)

    const actorStore = this.store.forActor(fromActor)
    const activity = await actorStore.inbox.get(activityId)

    const { type } = activity

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      await this.rejectFollow(fromActor, activity)
    }
    await actorStore.inbox.remove(activityId)
    await this.hookSystem.dispatchOnRejected(fromActor, activity)
  }

  async notifyFollowers (
    fromActor: string,
    activity: APActivity
  ): Promise<void> {
    // get followers list from store
    const followers = await this.store.forActor(fromActor).followers.list()
    // loop through each
    await Promise.all(
      followers.map(async (mention) => {
        try {
          const actorURL = await this.mentionToActor(mention)
          return await this.sendTo(actorURL, fromActor, activity)
        } catch (e) {
          // TODO: Remove deleted accounts
          this.log.error({ actor: fromActor }, 'Unable to notify actor')
        }
      })
    )
  }

  async notifyInteracted (
    fromActor: string,
    activity: APActivity
  ): Promise<void> {
    const interacted = await this.store.forActor(fromActor).interacted.list()
    // loop through each
    await Promise.all(
      interacted.map(async (mention) => {
        try {
          const actorURL = await this.mentionToActor(mention)
          return await this.sendTo(actorURL, fromActor, activity)
        } catch (e) {
          // TODO: Remove deleted accounts?
          this.log.error({ actor: fromActor }, 'Unable to notify actor')
        }
      })
    )
  }

  async performUndo (fromActor: string, activity: APActivity): Promise<void> {
    const { actor } = activity
    let object = activity.object
    if (typeof object !== 'string') {
      if ((object != null) && 'id' in object && typeof object.id === 'string') {
        object = object.id
      } else {
        throw createError(400, 'Undo must point to URL of object')
      }
    }
    if (typeof actor !== 'string') {
      throw createError(400, 'Activities must contain an actor string')
    }

    const inbox = this.store.forActor(fromActor).inbox

    // This throws if we haven't seen this activity before
    const existing = await inbox.get(object)
    if (existing.actor !== actor) {
      throw createError(
        400,
        'Undo can only point to activities by same author'
      )
    }
    await inbox.remove(object)
    await this.hookSystem.dispatchOnApproved(fromActor, activity)

    // Detect if follow
    if (existing.type === 'Follow') {
      const followerMention = await this.actorToMention(actor, fromActor)
      await this.removeFollower(fromActor, followerMention)
    }
  }

  async removeFollower (
    fromActor: string,
    followerMention: string
  ): Promise<void> {
    await this.store.forActor(fromActor).followers.remove([followerMention])
  }

  async acceptFollow (
    fromActor: string,
    followActivity: APActivity
  ): Promise<void> {
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

    this.backfillOutbox(fromActor, webmention).catch((e) => {
      this.log.error(
        { error: e, fromActor, toActor: webmention },
        'Unable to backfill follower'
      )
    })
  }

  async rejectFollow (
    fromActor: string,
    followActivity: APActivity
  ): Promise<void> {
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

  async repliesCollection (
    fromActor: string,
    inReplyTo: string,
    to?: string
  ): Promise<APCollection> {
    const items = await this.store
      .forActor(fromActor)
      .inboxObjects.list({ inReplyTo, to })
    const id = this.makeURL(
      `/v1/${fromActor}/inbox/replies/${btoa(inReplyTo)}`
    )

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Collection',
      id,
      items,
      totalItems: items.length
    }
  }

  // TODO: paging?
  async likesCollection (
    fromActor: string,
    object: string,
    countOnly: boolean = false
  ): Promise<APCollection> {
    const activities = await this.store
      .forActor(fromActor)
      .inbox.list({ limit: Infinity, type: 'Like', object })
    const id = this.makeURL(`/v1/${fromActor}/inbox/likes/${btoa(object)}`)

    const items = countOnly ? undefined : activities

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Collection',
      id,
      items,
      totalItems: activities.length
    }
  }

  // TODO: paging?
  async sharesCollection (
    fromActor: string,
    object: string,
    countOnly: boolean = false
  ): Promise<APCollection> {
    const activities = await this.store
      .forActor(fromActor)
      .inbox.list({ limit: Infinity, type: 'Announce', object })
    const id = this.makeURL(`/v1/${fromActor}/inbox/shares/${btoa(object)}`)

    const items = countOnly ? undefined : activities

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Collection',
      id,
      items,
      totalItems: activities.length
    }
  }

  async followersCollection (
    fromActor: string,
    countOnly: boolean = false
  ): Promise<APCollection> {
    const actorStore = this.store.forActor(fromActor)
    const actorURL = await this.mentionToActor(fromActor)

    const profile = await this.getActor(actorURL, fromActor)
    let followersURL = profile.followers
    // TODO: handle array of string?
    if (typeof followersURL !== 'string') {
      followersURL = actorURL + '#followers'
    }

    const followers = await actorStore.followers.list()
    const totalItems = followers.length

    const items = countOnly
      ? undefined
      : (
          await Promise.all(
            followers.map(async (mention) => {
              try {
                const url = await this.mentionToActor(mention)
                return url
              } catch {
              // If we can't resolve them just don't show them
                return ''
              }
            })
          // Filter out failed loads
          )
        ).filter((item) => item.length !== 0)

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: followersURL,
      items,
      totalItems
    }
  }

  async getOutboxItem (fromActor: string, id: string): Promise<APActivity> {
    const apId = this.makeURL(`/v1/${fromActor}/outbox/${id}`)

    return await this.store.forActor(fromActor).outbox.get(apId)
  }
}

export function makeActivity (
  type: string,
  id: string,
  actor: string,
  object: any
): APActivity {
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

function isOrderedCollection (
  collection: SomeSortOfCollection
): collection is APOrderedCollection {
  return collection.type === 'OrderedCollection'
}

function isCollection (
  collection: SomeSortOfCollection
): collection is APCollection {
  return collection.type === 'Collection'
}

function isOrderedCollectionPage (
  collection: SomeSortOfCollection
): collection is APOrderedCollectionPage {
  return collection.type === 'OrderedCollectionPage'
}

function isCollectionPage (
  collection: SomeSortOfCollection
): collection is APCollectionPage {
  return collection.type === 'CollectionPage'
}

function collectionItems (collection: SomeSortOfCollection): ObjectField[] {
  if (isCollection(collection)) {
    return (collection as APCollection).items ?? []
  }
  if (isCollectionPage(collection)) {
    return (collection as APCollectionPage).items ?? []
  }
  if (isOrderedCollection(collection)) {
    return (collection as APOrderedCollection).orderedItems ?? []
  }
  if (isOrderedCollectionPage(collection)) {
    return (collection as APOrderedCollectionPage).orderedItems ?? []
  }
  return []
}
