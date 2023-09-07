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

const NEWLINE = '\n'

type VALID_METHODS = typeof GET | typeof POST | typeof DELETE

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

  async sendActorInbox (actor: string, activity: APActivity): Promise<void> {
    await this.sendRequest(POST, `/${actor}/inbox`, TYPE_LDJSON, activity)
  }

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
}
