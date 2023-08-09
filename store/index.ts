import { AbstractLevel } from 'abstract-level'
import { APIConfig } from '../api/index.js'
import { APActivity } from 'activitypub-types'

export default class Store {
  db: AbstractLevel<any, string, any>
  domains: Map<string, DomainStore>
  domainDB: AbstractLevel<any, string, any>
  blocklist: AccountListStore
  allowlist: AccountListStore

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.domains = new Map()
    this.domainDB = this.db.sublevel('domains', { valueEncoding: 'json' })
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

    return this.domains.get(domain)
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
  }

  async add (url: string, activity: APActivity): Promise<void> {
    // application should fetch the url from the activity or normalize whatever
    // // make key from url and put
  }

  async remove (url: string): Promise<void> {
    // make key from url and delete
  }

  async list (): Promise<APActivity[]> {
    // iterate, parse list

  }
}

export class AccountListStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  patternToKey (pattern : string): string {
  // split into domain and username
  // \x00{domain}\x00{username}
  }

  async matches (username : string): Promise<boolean> {
    // split by name and domain
    // make into key
    // check if @*@domain is in the filter
    // check if username key is in filter
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
  }
}
