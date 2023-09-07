import Store from '../store/index.js'

export const BLOCKED = 'blocked'
export const ALLOWED = 'allowed'
export const QUEUE = 'queue'

export type ModerationState = typeof BLOCKED | typeof ALLOWED | typeof QUEUE

export class ModerationChecker {
  private readonly store: Store

  constructor (store: Store) {
    this.store = store
  }

  async check (pattern: string, actor: string): Promise<ModerationState> {
    const actorStore = this.store.forActor(actor)

    // Check if in the actor-specific allowlist
    if (await actorStore.allowlist.matches(pattern)) {
      return ALLOWED
    }

    // Check if in the actor-specific blocklist
    if (await actorStore.blocklist.matches(pattern)) {
      return BLOCKED
    }

    if (await this.store.admins.matches(pattern)) {
      return ALLOWED
    }

    // Check if in the global blocklist
    if (await this.store.blocklist.matches(pattern)) {
      return BLOCKED
    }

    // Check if in the global allowlist
    if (await this.store.allowlist.matches(pattern)) {
      return ALLOWED
    }

    return QUEUE
  }

  async isAllowed (pattern: string, actor: string): Promise<boolean> {
    const state = await this.check(pattern, actor)

    return state !== BLOCKED
  }
}
