import { AbstractLevel } from 'abstract-level'
import { APActivity } from 'activitypub-types'
import { ActivityStore } from './ActivityStore.js'

export class ReplyStore {
  db: AbstractLevel<any, string, any>
  repliesCache: Map<string, ActivityStore>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.repliesCache = new Map()
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  forPost (postURL: string): ActivityStore {
    if (!this.repliesCache.has(postURL)) {
      const sub = this.db.sublevel(postURL, { valueEncoding: 'json' })
      const store = new ActivityStore(sub)
      this.repliesCache.set(postURL, store)
    }

    const store = this.repliesCache.get(postURL)
    if (store == null) {
      throw new Error('Domain store not initialized')
    }
    return store
  }

  async add (reply: APActivity): Promise<void> {
    if (reply.id === undefined) {
      throw new Error('Reply ID is missing.')
    }
    const store = this.forPost(reply.id)
    await store.add(reply)
  }

  async remove (url: string): Promise<void> {
    const store = this.forPost(url)
    await store.remove(url)
  }

  async get (url: string): Promise<APActivity> {
    const store = this.forPost(url)
    return await store.get(url)
  }

  async list (postURL: string): Promise<APActivity[]> {
    const store = this.forPost(postURL)
    return await store.list()
  }
}
