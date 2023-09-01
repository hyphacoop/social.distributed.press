import { AbstractLevel } from 'abstract-level'
import { ActorInfo } from './index'
import { ActivityStore } from './ActivityStore'
import { AccountListStore } from './AccountListStore'
import { HookStore } from './HookStore'

export class ActorStore {
  db: AbstractLevel<any, string, any>
  inbox: ActivityStore
  blocklist: AccountListStore
  allowlist: AccountListStore
  followers: AccountListStore
  hooks: HookStore

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    const inboxDB = this.db.sublevel('inbox', { valueEncoding: 'json' })
    this.inbox = new ActivityStore(inboxDB)

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

    const hooksDb = this.db.sublevel('hooks', { valueEncoding: 'json' })
    this.hooks = new HookStore(hooksDb)
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
