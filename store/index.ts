import { AbstractLevel } from 'abstract-level'
import { APIConfig } from '../api/index.js'
import { APActivity } from 'activitypub-types'
import { KeyPair } from '../keypair.js'

export interface DomainInfo {
  // The actor for the domain inbox
  actorUrl: string
  publicKeyId: string
  keypair: KeyPair
}

export default class Store {
  db: AbstractLevel<any, string, any>
  domains: Map<string, DomainStore>
  domainDb: AbstractLevel<any, string, any>
  blocklist: AccountListStore
  allowlist: AccountListStore
  config: APIConfig

  constructor (config: APIConfig, db: AbstractLevel<any, string, any>) {
    this.config = config
    this.db = db
    this.domains = new Map()
    this.domainDb = this.db.sublevel('domains', { valueEncoding: 'json' })
    const blocklistDb = this.db.sublevel('blocklist', { valueEncoding: 'json' })
    this.blocklist = new AccountListStore(blocklistDb)
    const allowlistDb = this.db.sublevel('allowlist', { valueEncoding: 'json' })
    this.allowlist = new AccountListStore(allowlistDb)
  }

  forDomain (domain: string): DomainStore {
    if (!this.domains.has(domain)) {
      const sub = this.db.sublevel(domain, { valueEncoding: 'json' })
      const store = new DomainStore(sub)
      this.domains.set(domain, store)
    }

    const store = this.domains.get(domain)
    if (store == null) {
      throw new Error('Domain store not initialixed')
    }
    return store
  }
}

export class DomainStore {
  db: AbstractLevel<any, string, any>
  inbox: InboxStore
  blocklist: AccountListStore
  allowlist: AccountListStore
  followers: AccountListStore

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    const inboxDB = this.db.sublevel('inbox', { valueEncoding: 'json' })
    this.inbox = new InboxStore(inboxDB)

    const blocklistDb = this.db.sublevel('blocklist', { valueEncoding: 'json' })
    this.blocklist = new AccountListStore(blocklistDb)

    const allowlistDb = this.db.sublevel('allowlist', { valueEncoding: 'json' })
    this.allowlist = new AccountListStore(allowlistDb)

    const followerDb = this.db.sublevel('followers', { valueEncoding: 'json' })
    this.followers = new AccountListStore(followerDb)
  }
}

export class InboxStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (activity: APActivity): Promise<void> {
    // application should fetch the url from the activity or normalize whatever
    // // make key from url and put
  }

  async remove (url: string): Promise<void> {
    // make key from url and delete
  }

  async list (): Promise<APActivity[]> {
    // iterate, parse list
    return []
  }
}

export class AccountListStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  patternToKey (pattern: string): string {
  // split into domain and username
  // \x00{domain}\x00{username}
    return ''
  }

  async matches (username: string): Promise<boolean> {
    // split by name and domain
    // make into key
    // check if @*@domain is in the filter
    // check if username key is in filter
    return false
  }

  async add (patterns: string[]): Promise<void> {
    // start batch
    // make keys for each item
    // put into batch
    // flush
  }

  async remove (patterns: string[]): Promise<void> {
    // start batch
    // make keys for each item
    // delete into batch
    // flush
  }

  async list (): Promise<string[]> {
    return []
  }
}
