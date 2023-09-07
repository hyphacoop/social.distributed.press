import { Type, Static } from '@sinclair/typebox'
import { AbstractLevel } from 'abstract-level'

import { KeyPairSchema } from '../keypair.js'
import { ActorStore } from './ActorStore'
import { AccountListStore } from './AccountListStore'

export const ActorInfoSchema = Type.Object({
  // The actor for the domain inbox
  actorUrl: Type.String(),
  publicKeyId: Type.String(),
  keypair: KeyPairSchema
})

export type ActorInfo = Static<typeof ActorInfoSchema>

export default class Store {
  db: AbstractLevel<any, string, any>
  actorCache: Map<string, ActorStore>
  actorsDb: AbstractLevel<any, string, any>
  blocklist: AccountListStore
  allowlist: AccountListStore
  admins: AccountListStore

  // TODO: Have store config which just needs the specific fields for the store
  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.actorCache = new Map()
    this.actorsDb = this.db.sublevel('actorCache', { valueEncoding: 'json' })
    const blocklistDb = this.db.sublevel('blocklist', {
      valueEncoding: 'json'
    })
    this.blocklist = new AccountListStore(blocklistDb)
    const allowlistDb = this.db.sublevel('allowlist', {
      valueEncoding: 'json'
    })
    this.allowlist = new AccountListStore(allowlistDb)
    const adminsDb = this.db.sublevel('admins', {
      valueEncoding: 'json'
    })
    this.admins = new AccountListStore(adminsDb)
  }

  forActor (domain: string): ActorStore {
    if (!this.actorCache.has(domain)) {
      const sub = this.db.sublevel(domain, { valueEncoding: 'json' })
      const store = new ActorStore(sub)
      this.actorCache.set(domain, store)
    }

    const store = this.actorCache.get(domain)
    if (store == null) {
      throw new Error('Domain store not initialixed')
    }
    return store
  }
}