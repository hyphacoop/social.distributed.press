import { AbstractLevel } from 'abstract-level'
import { APActivity } from 'activitypub-types'
import createError from 'http-errors'
import { Mutex } from 'async-mutex'

export const LATEST_VERSON = '2'

// Index is separated by `!`, when we want to iterate over db, set gt to this
const START_NON_INDEX_KEYS = String.fromCharCode('!'.charCodeAt(0) + 1)

export class ActivityStore {
  db: AbstractLevel<any, string, any>
  migrationMutex: Mutex = new Mutex()
  hasMigrated: boolean = false

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  get indexesDB (): AbstractLevel<any, string, any> {
    return this.db
      .sublevel('indexes', { valueEncoding: 'json' })
  }

  get publishedIndex (): AbstractLevel<any, string, any> {
    return this.indexesDB
      .sublevel('published', { valueEncoding: 'json' })
  }

  actorIndexFor (actor: string): AbstractLevel<any, string, any> {
    return this.indexesDB
      .sublevel('actor')
      .sublevel(actor, { valueEncoding: 'json' })
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (activity: APActivity): Promise<void> {
    await this.migrate()
    if (activity.id === undefined) {
      throw createError(400, 'Activity ID is missing.')
    }
    if (activity.published === undefined) {
      activity.published = new Date().toISOString()
    }
    const key = this.urlToKey(activity.id)
    await this.db.put(key, activity)
    await this.addToIndex(activity)
  }

  async remove (url: string): Promise<void> {
    const key = this.urlToKey(url)
    await this.removeFromIndex(url)
    await this.db.del(key)
  }

  async addToIndex (activity: APActivity): Promise<void> {
    const { published, id } = activity
    if (published === undefined || id === undefined) return
    const publishedString = new Date(published).toISOString()
    await this.publishedIndex
      .sublevel(publishedString, { valueEncoding: 'json' })
      .put(id, id)

    if (typeof activity.actor === 'string') {
      await this.actorIndexFor(activity.actor)
        .sublevel(publishedString, { valueEncoding: 'json' })
        .put(id, id)
    }
  }

  async removeFromIndex (url: string): Promise<void> {
    const activity = await this.get(url)
    const { published, id } = activity
    if (published === undefined || id === undefined) return
    const publishedString = new Date(published).toISOString()
    await this.publishedIndex
      .sublevel(publishedString).del(id)

    if (typeof activity.actor === 'string') {
      await this.actorIndexFor(activity.actor)
        .sublevel(publishedString)
        .del(id)
    }
  }

  async get (url: string): Promise<APActivity> {
    const key = this.urlToKey(url)
    try {
      const activity: APActivity = await this.db.get(key)
      return activity
    } catch (error) {
      throw createError(404, `Activity not found for URL: ${url}`)
    }
  }

  async getVersion (): Promise<string> {
    try {
      return await this.indexesDB.get('version', { valueEncoding: 'json' })
    } catch {
      return '0'
    }
  }

  async migrate (): Promise<void> {
    if (this.hasMigrated) return
    await this.migrationMutex.runExclusive(async () => {
      if (this.hasMigrated) return
      const version = await this.getVersion()
      if (version === '0' || version === '1') {
        // Clear old published index
        await this.indexesDB.clear()
        // Ensure each activity has a published field
        for await (const activity of this.db.values()) {
          if (activity.published === undefined) {
            activity.published = new Date().toISOString()
            await this.db.put(this.urlToKey(activity.id), activity)
          }
          await this.addToIndex(activity)
        }

        await this.indexesDB.put('version', LATEST_VERSON)
        this.hasMigrated = true

        // Remove deletes from authors without other info
        for await (const activity of this.db.values({ gt: START_NON_INDEX_KEYS })) {
          if (!await this.hasPostsFrom(activity.actor)) {
            await this.remove(activity.id)
          }
        }
      }
      this.hasMigrated = true
    })
  }

  async hasPostsFrom (actor: string): Promise<boolean> {
    // Migrate if we haven't already
    await this.migrate()
    for await (const url of this.actorIndexFor(actor).values()) {
      const activity = await this.get(url)
      // This is to avoid the delete spam
      // We only want to track deletes if we have posts from a specific user
      if (activity.type !== 'Delete') return true
    }
    return false
  }

  async list (skip: number = 0, limit: number = 32): Promise<APActivity[]> {
    await this.migrate()
    const activities: APActivity[] = []
    let skipped = 0
    for await (const [indexKey, id] of this.publishedIndex.iterator({ limit: limit + skip, reverse: true })) {
      if (skipped < skip) {
        skipped++
        continue
      }
      try {
        const activity = await this.get(id)
        activities.push(activity)
      } catch (e) {
        await this.publishedIndex.del(indexKey)
      }
    }
    return activities
  }

  async count (): Promise<number> {
    let count = 0
    for await (const key of this.db.keys()) { // eslint-disable-line @typescript-eslint/no-unused-vars
      if (key.startsWith('!')) continue
      count++
    }
    return count
  }
}
