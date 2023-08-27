import Store from '../store/index.js'

export class ModerationChecker {
  private readonly store: Store

  constructor (store: Store) {
    this.store = store
  }

  async isAllowed (pattern: string, actor: string): Promise<boolean> {
    const actorStore = this.store.forActor(actor)

    // Check if in the global blocklist
    if (await this.store.blocklist.matches(pattern)) {
      return false
    }

    // Check if in the actor-specific blocklist
    if (await actorStore.blocklist.matches(pattern)) {
      return false
    }

    // Check if in the global allowlist
    if (await this.store.allowlist.matches(pattern)) {
      return true
    }

    // Check if in the actor-specific allowlist
    if (await actorStore.allowlist.matches(pattern)) {
      return true
    }

    // If not on any list, we can implement a default behavior here.
    // For this example, if the pattern is not on any list, it's allowed.
    // We can change this default as per our needs.
    return true
  }
}
