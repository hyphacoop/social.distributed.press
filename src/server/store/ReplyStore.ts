import { AbstractLevel } from 'abstract-level'
import { APActivity } from 'activitypub-types'

export class ReplyStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (reply: APActivity): Promise<void> {
    if (reply.id === undefined) {
      throw new Error('Reply ID is missing.')
    }
    const key = this.urlToKey(reply.id)
    await this.db.put(key, reply)
  }

  async remove (url: string): Promise<void> {
    const key = this.urlToKey(url)
    await this.db.del(key)
  }

  async get (url: string): Promise<APActivity> {
    const key = this.urlToKey(url)
    try {
      const reply: APActivity = await this.db.get(key)
      return reply
    } catch (error) {
      throw new Error(`Reply not found for URL: ${url}`)
    }
  }

  async list (): Promise<APActivity[]> {
    const replies: APActivity[] = []
    for await (const value of this.db.values()) {
      replies.push(value)
    }
    return replies
  }
}
