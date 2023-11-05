import { AbstractLevel } from 'abstract-level'
import { AnyAPObject } from 'activitypub-types'
import { APObjectStore } from './APObjectStore.js'

export class ReplyStore {
  db: AbstractLevel<any, string, any>
  repliesCache: Map<string, APObjectStore>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.repliesCache = new Map()
  }

  urlToKey (url: string): string {
    return encodeURIComponent(url)
  }

  forPost (postURL: string): APObjectStore {
    if (!this.repliesCache.has(postURL)) {
      const sub = this.db.sublevel(postURL, { valueEncoding: 'json' })
      const store = new APObjectStore(sub)
      this.repliesCache.set(postURL, store)
    }

    const store = this.repliesCache.get(postURL)
    if (store == null) {
      throw new Error('Domain store not initialized')
    }
    return store
  }

  async add (reply: AnyAPObject): Promise<void> {
    if (reply.id === undefined) {
      throw new Error('Reply ID is missing.')
    }

    // Check if the reply has 'inReplyTo' property.
    if (!('inReplyTo' in reply) || typeof reply.inReplyTo !== 'string') {
      throw new Error('The reply does not contain an inReplyTo property.')
    }

    // Use 'inReplyTo' from 'reply' for the post URL.
    const store = this.forPost(reply.inReplyTo)
    await store.add(reply)
  }

  async list (postURL: string): Promise<AnyAPObject[]> {
    const store = this.forPost(postURL)
    return await store.list()
  }
}
