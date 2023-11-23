import { AbstractLevel } from 'abstract-level'

export const FULL_WILDCARD = '@*@*'

export class AccountListStore {
  db: AbstractLevel<any, string, any>

  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  patternToKey (pattern: string): string {
    const [,username, domain] = pattern.split('@')
    return `\x00${domain}\x00${username}`
  }

  async hasCatchAll (): Promise<boolean> {
  // make into key for wildcard
    const key = this.patternToKey(FULL_WILDCARD)
    try {
      await this.db.get(key)
      return true // found a wildcard match
    } catch (error) {
      // ignore, no wildcard match
      return false
    }
  }

  // Format: @username@domain.com
  async matches (username: string): Promise<boolean> {
    const domain = username.split('@')[2]

    if (await this.hasCatchAll()) {
      return true
    }

    // make into key for wildcard
    const wildcardKey = this.patternToKey(`@*@${domain}`)
    try {
      await this.db.get(wildcardKey)
      return true // found a wildcard match
    } catch (error) {
      // ignore, no wildcard match
    }

    // make into key for the specific username
    const key = this.patternToKey(username)
    try {
      await this.db.get(key)
      return true // found an exact match
    } catch (error) {
      return false // no exact match found
    }
  }

  async has (username: string): Promise<boolean> {
    const key = this.patternToKey(username)
    try {
      await this.db.get(key)
      return true // found an exact match
    } catch (error) {
      return false // no exact match found
    }
  }

  async add (patterns: string[]): Promise<void> {
    const batch = this.db.batch()
    patterns.forEach((pattern) => {
      const key = this.patternToKey(pattern)
      batch.put(key, pattern)
    })
    await batch.write()
  }

  async remove (patterns: string[]): Promise<void> {
    const batch = this.db.batch()
    patterns.forEach((pattern) => {
      const key = this.patternToKey(pattern)
      batch.del(key)
    })
    await batch.write()
  }

  async list (): Promise<string[]> {
    const patterns: string[] = []
    for await (const value of this.db.values()) {
      patterns.push(value)
    }
    return patterns
  }
}
