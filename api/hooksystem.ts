import type { APActivity } from 'activitypub-types'
import type { BasicFetchParams, FetchLike } from './apsystem'
import Store from '../store/index'
import { Hook } from '../store/HookStore'

export default class HookSystem {
  store: Store
  fetch: FetchLike

  constructor (store: Store, fetch: FetchLike = globalThis.fetch) {
    this.store = store
    this.fetch = fetch
  }

  async setModerationQueued (actor: string, hook: Hook): Promise<void> {
    await this.store.forActor(actor).hooks.setModerationQueued(hook)
  }

  async getModerationQueued (actor: string): Promise<Hook | null> {
    return await this.store.forActor(actor).hooks.getModerationQueued()
  }

  async deleteModerationQueued (actor: string): Promise<void> {
    await this.store.forActor(actor).hooks.deleteModerationQueued()
  }

  async setOnApprovedHook (actor: string, hook: Hook): Promise<void> {
    await this.store.forActor(actor).hooks.setOnApprovedHook(hook)
  }

  async getOnApprovedHook (actor: string): Promise<Hook | null> {
    return await this.store.forActor(actor).hooks.getOnApprovedHook()
  }

  async deleteOnApprovedHook (actor: string): Promise<void> {
    await this.store.forActor(actor).hooks.deleteOnApprovedHook()
  }

  async setOnRejectedHook (actor: string, hook: Hook): Promise<void> {
    await this.store.forActor(actor).hooks.setOnRejectedHook(hook)
  }

  async getOnRejectedHook (actor: string): Promise<Hook | null> {
    return await this.store.forActor(actor).hooks.getOnRejectedHook()
  }

  async deleteOnRejectedHook (actor: string): Promise<void> {
    await this.store.forActor(actor).hooks.deleteOnRejectedHook()
  }

  async dispatchModerationQueued (actor: string, activity: APActivity): Promise<boolean> {
    return await this.dispatchHook('ModerationQueued', actor, activity)
  }

  async dispatchOnApproved (actor: string, activity: APActivity): Promise<boolean> {
    return await this.dispatchHook('OnApproved', actor, activity)
  }

  async dispatchOnRejected (actor: string, activity: APActivity): Promise<boolean> {
    return await this.dispatchHook('OnRejected', actor, activity)
  }

  private async dispatchHook (hookType: string, actor: string, activity: APActivity): Promise<boolean> {
    const hook = await this.store.forActor(actor).hooks.getHook(hookType)

    if (hook == null) {
      return false
    }

    const request: BasicFetchParams = {
      url: hook.url,
      method: hook.method,
      headers: (typeof hook.headers !== 'undefined' && hook.headers !== null) ? hook.headers : {},
      body: JSON.stringify(activity)
    }

    if (hook.method === 'GET') {
      delete request.body
    }

    const response = await this.fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })

    return response.ok
  }
}
