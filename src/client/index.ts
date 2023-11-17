import { APActivity } from 'activitypub-types'

import { KeyPair } from '../keypair.js'
import { ActorInfo } from '../schemas.js'

export type FetchLike = typeof globalThis.fetch

export interface SocialInboxOptions {
  instance: string
  account: string
  keypair: KeyPair
  fetch?: FetchLike
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
  keypair: KeyPair
  fetch: FetchLike

  constructor (options: SocialInboxOptions) {
    this.instance = options.instance
    this.account = options.account
    this.keypair = options.keypair
    this.fetch = options.fetch ?? globalThis.fetch
  }

  async sendRequest (method: VALID_METHODS, path: string, contentType?: VALID_TYPES, data?: any): Promise<Response> {
    const url = new URL(`/v1${path}`, this.instance).href
    let body = data

    if (contentType === TYPE_LDJSON || contentType === TYPE_JSON) {
      body = JSON.stringify(body, null, '\t')
    }

    const finalContentType = contentType ?? TYPE_TEXT

    // TODO: Signing
    const response = await this.fetch(url, {
      method,
      headers: {
        'Content-Type': finalContentType
      },
      body
    })

    if (!response.ok) {
      const message = `Could not send ${method} to ${url}, status ${response.status}:\n${await response.text()}`
      throw new Error(message)
    }

    return response
  }

  // Actorinfo
  async setActorInfo (actor: string, info: ActorInfo): Promise<void> {
    await this.sendRequest(POST, `/${actor}/`, TYPE_JSON, info)
  }

  async getActorInfo (actor: string): Promise<ActorInfo> {
    const response = await this.sendRequest(GET, `/${actor}/`)
    return await response.json()
  }

  async deleteActor (actor: string): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/`)
  }

  async setInfo (info: ActorInfo): Promise<void> {
    return await this.setActorInfo(this.account, info)
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
  async listFollowers (actor: string): Promise<string[]> {
    const response = await this.sendRequest(GET, `/${actor}/followers`)
    return await response.json()
  }

  async removeFollower (actor: string, follower: string): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/followers/${encodeURIComponent(follower)}`)
  }

  // Hooks
  async getHook (actor: string, hookType: string): Promise<any> {
    const response = await this.sendRequest(GET, `/${actor}/hooks/${hookType}`)
    return await response.json()
  }

  async setHook (actor: string, hookType: string, hook: any): Promise<void> {
    await this.sendRequest(PUT, `/${actor}/hooks/${hookType}`, TYPE_JSON, hook)
  }

  async deleteHook (actor: string, hookType: string): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/hooks/${hookType}`)
  }

  // Inbox
  async fetchInbox (actor: string): Promise<any> {
    const response = await this.sendRequest(GET, `/${actor}/inbox`)
    return await response.json()
  }

  async postToInbox (actor: string, activity: APActivity): Promise<void> {
    await this.sendRequest(POST, `/${actor}/inbox`, TYPE_LDJSON, activity)
  }

  async approveInboxItem (actor: string, itemId: string): Promise<void> {
    await this.sendRequest(POST, `/${actor}/inbox/${itemId}`)
  }

  async rejectInboxItem (actor: string, itemId: string): Promise<void> {
    await this.sendRequest(DELETE, `/${actor}/inbox/${itemId}`)
  }

  // Outbox
  async postToOutbox (actor: string, activity: APActivity): Promise<void> {
    await this.sendRequest(POST, `/${actor}/outbox`, TYPE_LDJSON, activity)
  }

  async fetchOutboxItem (actor: string, itemId: string): Promise<APActivity> {
    const response = await this.sendRequest(GET, `/${actor}/outbox/${itemId}`)
    return await response.json()
  }
}
