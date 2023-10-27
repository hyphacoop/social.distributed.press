import { AbstractLevel } from 'abstract-level'
import { AnyAPObject } from 'activitypub-types'

export class APObjectStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (object: AnyAPObject): Promise<void> {
    if (object.id === undefined) {
      throw new Error('Object ID is missing.')
    }
    const key = this.urlToKey(object.id)
    await this.db.put(key, object)
  }

  async remove (url: string): Promise<void> {
    const key = this.urlToKey(url)
    await this.db.del(key)
  }

  async get (url: string): Promise<AnyAPObject> {
    const key = this.urlToKey(url)
    try {
      const object: AnyAPObject = await this.db.get(key)
      return object
    } catch (error) {
      throw new Error(`Object not found for URL: ${url}`)
    }
  }

  async list (): Promise<AnyAPObject[]> {
    const objects: AnyAPObject[] = []
    for await (const value of this.db.values()) {
      objects.push(value)
    }
    return objects
  }
}
