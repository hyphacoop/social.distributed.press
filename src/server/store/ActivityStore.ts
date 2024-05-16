import { AbstractLevel } from 'abstract-level'
import { APActivity, PublishedField } from 'activitypub-types'
import createError from 'http-errors'

export class ActivityStore {
  db: AbstractLevel<any, string, any>

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
    await this.addToIndex(getPublished(activity.published), key)
  }

  async remove (url: string): Promise<void> {
    const key = this.urlToKey(url)
    await this.db.del(key)
    await this.removeFromIndex(key)
  }

  get publishedIndex() {
    return this.db
      .sublevel('indexes', { valueEncoding: 'json' })
      .sublevel('published', { valueEncoding: 'json' })
  }

  async addToIndex (publishedAt: Date, id: string): Promise<void> {
    await this.publishedIndex.put(`${publishedAt.toISOString()}-${id}`, id)
  }
  async removeFromIndex (id: string): Promise<void> {
    for await (const [key, value] of this.publishedIndex.iterator()) {
      if (value === id) {
        await this.publishedIndex.del(key)
        break
      }
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

  async list (skip: number = 0, limit: number = 999999): Promise<APActivity[]> {
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
    for await (const _ of this.db.keys()) {
      count++
    }
    return count
  }
}

function getPublished (published?: PublishedField): Date {
  if (published) {
    if (published instanceof Date) return published
    else return new Date(published)
  } else return new Date()
}