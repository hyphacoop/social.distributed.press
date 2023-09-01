import type { APActivity } from 'activitypub-types'
import type { BasicFetchParams, FetchLike } from './apsystem'
import { HookStore } from '../store/HookStore'

export default class HookSystem {
  store: HookStore
  fetch: FetchLike

  constructor (store: HookStore, fetch: FetchLike = globalThis.fetch) {
    this.store = store
    this.fetch = fetch
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
    const hook = await this.store.getHook(hookType)

    if (hook == null) {
      return false
    }

    const request: BasicFetchParams = {
      url: hook.url,
      method: hook.method,
      headers: hook.headers || {},
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
