import { AbstractLevel } from 'abstract-level'
import { APObject } from 'activitypub-types'
import createError from 'http-errors'

export const PUBLIC_TO_URL = 'https://www.w3.org/ns/activitystreams#Public'

export interface ListParameters {
  inReplyTo?: string
  attributedTo?: string
  to?: string
  skip?: number
  limit?: number
}

export class APObjectStore {
  db: AbstractLevel<any, string, any>
  objects: AbstractLevel<any, string, any>
  byAttributed: AbstractLevel<any, string, any>
  byReply: AbstractLevel<any, string, any>
  byPublished: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.objects = db.sublevel('objects', { valueEncoding: 'json' })
    this.byAttributed = db.sublevel('byAttributedTo')
    this.byReply = db.sublevel('byInReplyTo')
    this.byPublished = db.sublevel('byPublished')
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (object: APObject): Promise<void> {
    if (typeof object.id !== 'string') throw createError(400, 'Objects must have id fields')
    const hasPublished = typeof object.published === 'string'
    const hasInReplyTo = typeof object.inReplyTo === 'string'
    const hasAttributedTo = typeof object.attributedTo === 'string'
    if (hasPublished) {
      await this.byPublished
        .sublevel(object.published as string)
        .put(object.id, object.id)
    }
    if (hasPublished && hasInReplyTo) {
      await this.byReply
        .sublevel(object.inReplyTo as string)
        .sublevel(object.published as string)
        .put(object.id, object.id)
    }
    if (hasPublished && hasAttributedTo) {
      await this.byAttributed
        .sublevel(object.attributedTo as string)
        .sublevel(object.published as string)
        .put(object.id, object.id)
    }
    await this.objects.put(this.urlToKey(object.id), object)
  }

  async remove (url: string): Promise<void> {
    const object = await this.get(url)
    const hasPublished = typeof object.published === 'string'
    const hasInReplyTo = typeof object.inReplyTo === 'string'
    const hasAttributedTo = typeof object.attributedTo === 'string'
    if (hasPublished) {
      await this.byPublished
        .sublevel(object.published as string)
        .del(url)
    }
    if (hasPublished && hasInReplyTo) {
      await this.byReply
        .sublevel(object.inReplyTo as string)
        .sublevel(object.published as string)
        .del(url)
    }
    if (hasPublished && hasAttributedTo) {
      await this.byAttributed
        .sublevel(object.attributedTo as string)
        .sublevel(object.published as string)
        .del(url)
    }
    await this.objects.del(this.urlToKey(url))
  }

  async get (url: string): Promise<APObject> {
    const key = this.urlToKey(url)
    try {
      const note: APObject = await this.objects.get(key)
      return note
    } catch (error) {
      throw createError(404, `Object not found for URL: ${url}`)
    }
  }

  async list ({ skip = 0, limit = Infinity, attributedTo, inReplyTo, to }: ListParameters = {}): Promise<APObject[]> {
    const items: APObject[] = []

    let iterator = null

    if (inReplyTo !== undefined) {
      iterator = this.byReply.sublevel(inReplyTo).values({ reverse: true })
    } else if (attributedTo !== undefined) {
      iterator = this.byAttributed.sublevel(attributedTo).values({ reverse: true })
    } else {
      iterator = this.byPublished.values({ reverse: true })
    }

    for await (const url of iterator) {
      if (items.length >= limit) break
      if (skip !== 0) {
        skip--
        continue
      }
      const object = await this.get(url)

      const recipients: string[] = []

      if (Array.isArray(object.to)) {
        recipients.push(...object.to as string[])
      } else if (typeof object.to === 'string') {
        recipients.push(object.to)
      }

      if (Array.isArray(object.cc)) {
        recipients.push(...object.cc as string[])
      } else if (typeof object.cc === 'string') {
        recipients.push(object.cc)
      }

      if (!recipients.includes(PUBLIC_TO_URL)) {
        if ((to === undefined) || !recipients.includes(to)) {
          continue
        }
      }

      items.push(object)
    }

    return items
  }
}
