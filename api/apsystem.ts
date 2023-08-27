import type Store from '../store/index.js'
import type { APActivity, APActor } from 'activitypub-types'
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
  store: Store
  fetch: FetchLike

  constructor (store: Store, fetch: FetchLike = globalThis.fetch) {
    this.store = store
    this.fetch = fetch
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
    const headers = {
      ...initialHeaders,
      host: new URL(url).host,
      date: new Date().toUTCString()
    }

    // Sign data
    const signer = makeSigner(keypair, publicKeyId)
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
    const mentionURL = `https://${domain}/.well_known/?resource=${acct}`

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
    const domainStore = this.store.forActor(fromActor)
    // TODO: trigger hooks
    await domainStore.inbox.add(activity)
  }

  async approveActivity (fromActor: string, activityId: string): Promise<void> {
    const domainStore = this.store.forActor(fromActor)
    const activity = await domainStore.inbox.get(activityId)

    const { type } = activity

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      await this.acceptFollow(fromActor, activity)
    }
    await domainStore.inbox.remove(activityId)
  }

  async rejectActivity (fromActor: string, activityId: string): Promise<void> {
    const domainStore = this.store.forActor(fromActor)
    const activity = await domainStore.inbox.get(activityId)

    const { type } = activity

    // TODO: Handle other types + index by post
    if (type === 'Follow') {
      await this.acceptFollow(fromActor, activity)
    }
    await domainStore.inbox.remove(activityId)
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
    await this.store.forActor(fromActor).followers.remove(followerMention)
  }

  async acceptFollow (fromActor: string, followActivity: APActivity): Promise<void> {
    const fromActorURL = await this.mentionToActor(fromActor)
    const followId = followActivity.id as string
    const followerURL = followActivity.actor as string
    const response = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      // TODO: Resolve domain into actor?
      id: `${fromActorURL}/followers/${followId}`,
      type: 'Accept',
      actor: fromActorURL,
      object: followActivity
    }

    await this.sendTo(followerURL, fromActor, response)

    const webmention = await this.actorToMention(followerURL)

    await this.store.forActor(fromActor).followers.add(webmention)
  }

  async rejectFollow (fromActor: string, followActivity: APActivity): Promise<void> {
    const fromActorURL = await this.mentionToActor(fromActor)
    const followId = followActivity.id as string
    const followerURL = followActivity.actor as string
    const response = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      // TODO: Resolve domain into actor?
      id: `${fromActorURL}/followers/${followId}`,
      type: 'Reject',
      actor: fromActorURL,
      object: followActivity
    }

    await this.sendTo(followerURL, fromActor, response)
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
