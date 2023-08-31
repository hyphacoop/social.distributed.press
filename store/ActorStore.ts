import { AbstractLevel } from 'abstract-level'
import { ActorInfo } from './index'
import { ActivityStore } from './ActivityStore'
import { AccountListStore } from './AccountListStore'

export class ActorStore {
  db: AbstractLevel<any, string, any>
  inbox: ActivityStore
  outbox: ActivityStore
  blocklist: AccountListStore
  allowlist: AccountListStore
  followers: AccountListStore

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    const inboxDB = this.db.sublevel('inbox', { valueEncoding: 'json' })
    this.inbox = new ActivityStore(inboxDB)
    const outboxDB = this.db.sublevel('outbox', { valueEncoding: 'json' })
    this.outbox = new ActivityStore(outboxDB)

    const blocklistDb = this.db.sublevel('blocklist', {
      valueEncoding: 'json'
    })
    this.blocklist = new AccountListStore(blocklistDb)

    const allowlistDb = this.db.sublevel('allowlist', {
      valueEncoding: 'json'
    })
    this.allowlist = new AccountListStore(allowlistDb)

    const followerDb = this.db.sublevel('followers', { valueEncoding: 'json' })
    this.followers = new AccountListStore(followerDb)
  }

  async getInfo (): Promise<ActorInfo> {
    return await this.db.get('info')
  }

  async setInfo (info: ActorInfo): Promise<void> {
    await this.db.put('info', info)
  }

  async delete (): Promise<void> {
    // TODO: delete all keys within the db
  }
}
