import { AbstractLevel } from 'abstract-level'

export interface Hook {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: { [name: string]: string }
}

export class HookStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  async setHook (type: string, hook: Hook): Promise<void> {
    await this.db.put(type, hook)
  }

  async getHook (type: string): Promise<Hook | null> {
    try {
      return await this.db.get(type)
    } catch (error) {
      return null
    }
  }

  async deleteHook (type: string): Promise<void> {
    await this.db.del(type)
  }
}
