import { APActivity, APObject } from 'activitypub-types'
import { fetch as signedFetch, generateKeypair } from 'http-signed-fetch'
import { KeyPair } from '../keypair.js'
import { ActorInfo } from '../schemas.js'
import createError from 'http-errors'

export type SignedFetchLike = (
  url: RequestInfo,
  init?: RequestInit & { publicKeyId: string, keypair: KeyPair }
) => Promise<Response>

type Keypair = ReturnType<typeof generateKeypair> & {
  publicKeyId: string
}

export interface SocialInboxOptions {
  instance: string
  account: string
  keypair: Keypair
  fetch?: SignedFetchLike
}

export interface Hook {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: { [name: string]: string }
}

const TYPE_TEXT = 'text/plain'
const TYPE_LDJSON = 'applicatin/ld+json'
const TYPE_JSON = 'application/json'

const GET = 'GET'
const POST = 'POST'
const DELETE = 'DELETE'
const PUT = 'PUT'

const NEWLINE = '\n'

type VALID_METHODS = typeof GET | typeof POST | typeof PUT | typeof DELETE

type VALID_TYPES = typeof TYPE_TEXT | typeof TYPE_JSON | typeof TYPE_LDJSON | undefined

export class SocialInboxClient {
  instance: string
  account: string
  keypair: Keypair
  fetch: SignedFetchLike

  constructor (options: SocialInboxOptions) {
    this.instance = options.instance
    this.account = options.account
    this.keypair = options.keypair
    this.fetch = options.fetch ?? signedFetch
  }

  async sendRequest (method: VALID_METHODS, path: string, contentType?: VALID_TYPES, data?: any): Promise<Response> {
    const url = new URL(`/v1${path}`, this.instance).href
    let body = data

    if (contentType === TYPE_LDJSON || contentType === TYPE_JSON) {
      body = JSON.stringify(body, null, '\t')
    }

    const finalContentType = contentType ?? TYPE_TEXT

    // Extract publicKeyId from this.keypair
    const { publicKeyId, ...keypairWithoutId } = this.keypair

    const response = await this.fetch(url, {
      method,
      headers: {
        'Content-Type': finalContentType
      },
      body,
      keypair: keypairWithoutId,
      publicKeyId
    })

    if (!response.ok) {
      const message = `Could not send ${method} to ${url}, status ${response.status}:\n${await response.text()}`
      throw createError(response.status, message)
    }

    return response
  }

  // Actorinfo
  async setActorInfo (info: ActorInfo, actor: string = this.account): Promise<void> {
    await this.sendRequest(POST, `/${actor}`, TYPE_JSON, info)
  }

  async getActorInfo (actor: string = this.account): Promise<ActorInfo> {
    const response = await this.sendRequest(GET, `/${actor}/`)
    return await response.json()
  }

  async deleteActor (actor: string = this.account): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/`)
  }

  async setInfo (info: ActorInfo): Promise<void> {
    return await this.setActorInfo(info, this.account)
  }

  async getInfo (): Promise<ActorInfo> {
    return await this.getActorInfo(this.account)
  }

  async delete (): Promise<void> {
    return await this.deleteActor(this.account)
  }

  // Admins
  async listAdmins (): Promise<string[]> {
    const response = await this.sendRequest(GET, '/admins')
    const text = await response.text()
    return text.split(NEWLINE)
  }

  async addAdmins (admins: string[]): Promise<void> {
    await this.sendRequest(POST, '/admins', TYPE_TEXT, admins.join(NEWLINE))
  }

  async removeAdmins (admins: string[]): Promise<void> {
    await this.sendRequest(DELETE, '/admins', TYPE_TEXT, admins.join(NEWLINE))
  }

  // blocklist
  async getGlobalBlocklist (): Promise<string[]> {
    const response = await this.sendRequest(GET, '/blocklist')
    const text = await response.text()
    return text.split(NEWLINE)
  }

  async addGlobalBlocklist (list: string[]): Promise<void> {
    await this.sendRequest(POST, '/blocklist', TYPE_TEXT, list.join(NEWLINE))
  }

  async removeGlobalBlocklist (list: string[]): Promise<void> {
    await this.sendRequest(POST, '/blocklist', TYPE_TEXT, list.join(NEWLINE))
  }

  // Allowlist
  async getGlobalAllowlist (): Promise<string[]> {
    const response = await this.sendRequest(GET, '/allowlist')
    const text = await response.text()
    return text.split(NEWLINE)
  }

  async addGlobalAllowlist (accounts: string[]): Promise<void> {
    await this.sendRequest(POST, '/allowlist', TYPE_TEXT, accounts.join(NEWLINE))
  }

  async removeGlobalAllowlist (accounts: string[]): Promise<void> {
    await this.sendRequest(DELETE, '/allowlist', TYPE_TEXT, accounts.join(NEWLINE))
  }

  // Followers
  async listFollowers (actor: string = this.account): Promise<string[]> {
    const response = await this.sendRequest(GET, `/${actor}/followers`)
    return await response.json()
  }

  async removeFollower (follower: string, actor: string = this.account): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/followers/${encodeURIComponent(follower)}`)
  }

  // Hooks
  async getHook (hookType: string, actor: string = this.account): Promise<any> {
    const response = await this.sendRequest(GET, `/${actor}/hooks/${hookType}`)
    return await response.json()
  }

  async setHook (hookType: string, url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', headers: { [name: string]: string }, actor: string = this.account): Promise<void> {
    const hook = { url, method, headers }
    await this.sendRequest(PUT, `/${actor}/hooks/${hookType}`, TYPE_JSON, hook)
  }

  async deleteHook (hookType: string, actor: string = this.account): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/hooks/${hookType}`)
  }

  // Inbox
  async fetchInbox (actor: string = this.account): Promise<any> {
    const response = await this.sendRequest(GET, `/${actor}/inbox`)
    return await response.json()
  }

  async repliesFor (inReplyTo: string, actor: string): Promise<APObject[]> {
    // TODO: Handle collection stuff and paging
    const response = await this.sendRequest(GET, `/${actor}/inbox/replies/${inReplyTo}`)
    const collection = await response.json()
    return collection.item ?? collection.orderedItems
  }

  async postToInbox (activity: APActivity, actor: string = this.account): Promise<void> {
    await this.sendRequest(POST, `/${actor}/inbox`, TYPE_LDJSON, activity)
  }

  async approveInboxItem (itemId: string, actor: string = this.account): Promise<void> {
    await this.sendRequest(POST, `/${actor}/inbox/${itemId}`)
  }

  async rejectInboxItem (itemId: string, actor: string = this.account): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/inbox/${itemId}`)
  }

  // Outbox
  async postToOutbox (activity: APActivity, actor: string = this.account): Promise<void> {
    await this.sendRequest(POST, `/${actor}/outbox`, TYPE_LDJSON, activity)
  }

  async fetchOutboxItem (itemId: string, actor: string = this.account): Promise<APActivity> {
    const response = await this.sendRequest(GET, `/${actor}/outbox/${itemId}`)
    return await response.json()
  }
}
