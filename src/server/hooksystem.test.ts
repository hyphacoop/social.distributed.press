import test from 'ava'
import HookSystem from './hooksystem'

test('HookSystem triggers ModerationQueued with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Test' })
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'ModerationQueued') {
              return {
                url: 'https://example.com/hook',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              }
            }
            return null
          }
        }
      }
    }
  }

  // Initialize the HookSystem with mocked dependencies
  const hookSystem = new HookSystem(mockStore, mockFetch)

  // Test dispatching the hook
  const result = await hookSystem.dispatchModerationQueued('actorId', {
    type: 'Test'
  })

  t.true(result, 'Hook should be triggered successfully')
})

test('HookSystem triggers OnApproved with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook-approved')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TestApproved' })
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'OnApproved') {
              return {
                url: 'https://example.com/hook-approved',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              }
            }
            return null
          }
        }
      }
    }
  }

  // Initialize the HookSystem with mocked dependencies
  const hookSystem = new HookSystem(mockStore, mockFetch)

  // Test dispatching the hook
  const result = await hookSystem.dispatchOnApproved('actorId', {
    type: 'TestApproved'
  })

  t.true(result, 'Hook should be triggered successfully for OnApproved')
})

test('HookSystem triggers OnRejected with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook-rejected')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TestRejected' })
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'OnRejected') {
              return {
                url: 'https://example.com/hook-rejected',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              }
            }
            return null
          }
        }
      }
    }
  }

  // Initialize the HookSystem with mocked dependencies
  const hookSystem = new HookSystem(mockStore, mockFetch)

  // Test dispatching the hook
  const result = await hookSystem.dispatchOnRejected('actorId', {
    type: 'TestRejected'
  })

  t.true(result, 'Hook should be triggered successfully for OnRejected')
})
