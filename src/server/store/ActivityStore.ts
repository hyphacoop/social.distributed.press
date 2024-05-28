import { AbstractLevel } from 'abstract-level'
import { APActivity, PublishedField } from 'activitypub-types'
import createError from 'http-errors'
import { Mutex } from 'async-mutex'

export class ActivityStore {
  db: AbstractLevel<any, string, any>
  migrationMutex: Mutex = new Mutex()
  hasMigrated: boolean = false

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (activity: APActivity): Promise<void> {
    if (activity.id === undefined) {
      throw createError(400, 'Activity ID is missing.')
    }
    const key = this.urlToKey(activity.id)
    await this.db.put(key, activity)
    await this.addToIndex(activity)
  }

  async remove (url: string): Promise<void> {
    const key = this.urlToKey(url)
    await this.db.del(key)
    await this.removeFromIndex(url)
  }

  get indexesDB (): AbstractLevel<any, string, any> {
    return this.db
      .sublevel('indexes', { valueEncoding: 'json' })
  }

  get publishedIndex (): AbstractLevel<any, string, any> {
    return this.indexesDB
      .sublevel('published', { valueEncoding: 'json' })
  }

  makeIndexKey (activity: APActivity) {
    const publishedAt = getPublished(activity.published)
    const id = this.urlToKey(activity.id!)
    return `${publishedAt.toISOString()}-${id}`
  }

  async addToIndex (activity: APActivity): Promise<void> {
    const id = this.urlToKey(activity.id!)
    await this.publishedIndex.put(this.makeIndexKey(activity), id)
  }

  async removeFromIndex (url: string): Promise<void> {
    const activity = await this.get(url)
    this.publishedIndex.del(this.makeIndexKey(activity))
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

  async migrate (): Promise<void> {
    if (this.hasMigrated) return
    await this.migrationMutex.runExclusive(async () => {
      let version: number
      try {
        version = await this.indexesDB.get('version', { valueEncoding: 'json' })
      } catch {
        version = 0
      }
      switch (version) {
        case 0:
          for await (const id of this.db.keys()) {
            const activity = await this.db.get('id')
            await this.addToIndex(activity.published, id)
          }
          await this.indexesDB.put('version', '1')
      }
      this.hasMigrated = true
    })
  }

  async list (skip: number = 0, limit: number = 999999): Promise<APActivity[]> {
    await this.migrate()

    const activities: APActivity[] = []
    let skipped = 0
    for await (const id of this.publishedIndex.values({ limit: limit + skip })) {
      if (skipped < skip) {
        skipped++
        continue
      }
      activities.push(await this.db.get(id))
    }
    return activities
  }

  async count (): Promise<number> {
    let count = 0
    for await (const _ of this.db.keys()) { // eslint-disable-line @typescript-eslint/no-unused-vars
      count++
    }
    return count
  }
}

function getPublished (published?: PublishedField): Date {
  if (published !== undefined) {
    if (published instanceof Date) return published
    else return new Date(published)
  } else return new Date()
}
