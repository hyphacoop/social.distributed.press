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

    // Check if the reply has 'object' property and is not an array.
    if (!('object' in reply) || Array.isArray(reply.object) || typeof reply.object !== 'object') {
      throw new Error('The reply object does not contain a valid object property.')
    }

    const replyObject = reply.object

    // Check if the nested object has 'inReplyTo' property.
    if (!('inReplyTo' in replyObject) || typeof replyObject.inReplyTo !== 'string') {
      throw new Error('The nested object does not contain an inReplyTo property.')
    }

    // Use 'inReplyTo' for the post URL.
    const store = this.forPost(replyObject.inReplyTo)
    await store.add(replyObject)
  }

  async list (postURL: string): Promise<AnyAPObject[]> {
    const store = this.forPost(postURL)
    return await store.list()
  }
}
