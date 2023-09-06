import { AbstractLevel } from 'abstract-level'
import { Type } from '@sinclair/typebox'

export interface Hook {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: { [name: string]: string }
}

export const WebHookSchema = Type.Object({
  url: Type.String({
    format: 'uri'
  }),
  method: Type.Union([Type.Literal('GET'), Type.Literal('POST'), Type.Literal('PUT'), Type.Literal('DELETE')]),
  headers: Type.Record(Type.String(), Type.String())
})

export class HookStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  async set (type: string, hook: Hook): Promise<void> {
    await this.db.put(type, hook)
  }

  async get (type: string): Promise<Hook | null> {
    try {
      return await this.db.get(type)
    } catch (error) {
      return null
    }
  }

  async delete (type: string): Promise<void> {
    await this.db.del(type)
  }

  async setModerationQueued (hook: Hook): Promise<void> {
    await this.set('moderationqueued', hook)
  }

  async getModerationQueued (): Promise<Hook | null> {
    return await this.get('moderationqueued')
  }

  async deleteModerationQueued (): Promise<void> {
    await this.delete('moderationqueued')
  }

  async setOnApproved (hook: Hook): Promise<void> {
    await this.set('onapproved', hook)
  }

  async getOnApproved (): Promise<Hook | null> {
    return await this.get('onapproved')
  }

  async deleteOnApproved (): Promise<void> {
    await this.delete('onapproved')
  }

  async setOnRejected (hook: Hook): Promise<void> {
    await this.set('onrejected', hook)
  }

  async getOnRejected (): Promise<Hook | null> {
    return await this.get('onrejected')
  }

  async deleteOnRejected (): Promise<void> {
    await this.delete('onrejected')
  }
}
