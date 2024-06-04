import { AbstractLevel } from 'abstract-level'
import { APNote } from 'activitypub-types'
import createError from 'http-errors'

export interface ListParameters {
  inReplyTo?: string
  attributedTo?: string
  skip?: number
  limit?: number
}

export class NoteStore {
  db: AbstractLevel<any, string, any>
  notes: AbstractLevel<any, string, any>
  byAttributed: AbstractLevel<any, string, any>
  byReply: AbstractLevel<any, string, any>
  byPublished: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
    this.notes = db.sublevel('notes', { valueEncoding: 'json' })
    this.byAttributed = db.sublevel('byAttributedTo')
    this.byReply = db.sublevel('byInReplyTo')
    this.byPublished = db.sublevel('byPublished')
  }

  urlToKey (url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url)
  }

  async add (note: APNote): Promise<void> {
    if (typeof note.id !== 'string') throw createError(400, 'Notes must have id fields')
    const hasPublished = typeof note.published === 'string'
    const hasInReplyTo = typeof note.inReplyTo === 'string'
    const hasAttributedTo = typeof note.attributedTo === 'string'
    if (hasPublished) {
      await this.byPublished
        .sublevel(note.published as string)
        .put(note.id, note.id)
    }
    if (hasPublished && hasInReplyTo) {
      await this.byReply
        .sublevel(note.inReplyTo as string)
        .sublevel(note.published as string)
        .put(note.id, note.id)
    }
    if (hasPublished && hasAttributedTo) {
      await this.byAttributed
        .sublevel(note.attributedTo as string)
        .sublevel(note.published as string)
        .put(note.id, note.id)
    }
    await this.notes.put(this.urlToKey(note.id), note)
  }

  async remove (url: string): Promise<void> {
    const note = await this.get(url)
    const hasPublished = typeof note.published === 'string'
    const hasInReplyTo = typeof note.inReplyTo === 'string'
    const hasAttributedTo = typeof note.attributedTo === 'string'
    if (hasPublished) {
      await this.byPublished
        .sublevel(note.published as string)
        .del(url)
    }
    if (hasPublished && hasInReplyTo) {
      await this.byReply
        .sublevel(note.inReplyTo as string)
        .sublevel(note.published as string)
        .del(url)
    }
    if (hasPublished && hasAttributedTo) {
      await this.byAttributed
        .sublevel(note.attributedTo as string)
        .sublevel(note.published as string)
        .del(url)
    }
    await this.notes.del(this.urlToKey(url))
  }

  async get (url: string): Promise<APNote> {
    const key = this.urlToKey(url)
    try {
      const note: APNote = await this.notes.get(key)
      return note
    } catch (error) {
      throw createError(404, `Activity not found for URL: ${url}`)
    }
  }

  async list ({ skip = 0, limit = 32, attributedTo, inReplyTo }: ListParameters = {}): Promise<APNote[]> {
    const notes: APNote[] = []

    let iterator = null

    if (inReplyTo !== undefined) {
      iterator = this.byReply.sublevel(inReplyTo).values({ reverse: true })
    } else if (attributedTo !== undefined) {
      iterator = this.byAttributed.sublevel(attributedTo).values({ reverse: true })
    } else {
      iterator = this.byPublished.values({ reverse: true })
    }

    for await (const url of iterator) {
      if (notes.length >= limit) break
      if (skip !== 0) {
        skip--
        continue
      }
      notes.push(await this.get(url))
    }

    return notes
  }
}
