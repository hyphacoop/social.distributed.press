import Store, { DomainStore } from '../store/index.js'

export class ModerationChecker {
  private readonly store: Store

  constructor (store: Store) {
    this.store = store
  }

  async isAllowed (pattern: string, domain: string): Promise<boolean> {
    const domainStore = this.store.forDomain(domain)

    // Check if in the global blocklist
    if (await this.store.blocklist.matches(pattern)) {
      return false
    }

    // Check if in the domain-specific blocklist
    if (await domainStore.blocklist.matches(pattern)) {
      return false
    }

    // Check if in the global allowlist
    if (await this.store.allowlist.matches(pattern)) {
      return true
    }

    // Check if in the domain-specific allowlist
    if (await domainStore.allowlist.matches(pattern)) {
      return true
    }

    // If not on any list, we can implement a default behavior here.
    // For this example, if the pattern is not on any list, it's allowed.
    // We can change this default as per our needs.
    return true
  }
}
