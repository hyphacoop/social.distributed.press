import test from 'ava'
import HookSystem from './hooksystem.js'

test('HookSystem triggers moderationqueued with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Test' }),
      signal: AbortSignal.timeout(3000)
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'moderationqueued') {
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

test('HookSystem triggers onapproved with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook-approved')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TestApproved' }),
      signal: AbortSignal.timeout(3000)
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'onapproved') {
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

  t.true(result, 'Hook should be triggered successfully for onapproved')
})

test('HookSystem triggers onrejected with expected parameters', async (t) => {
  // Mock the fetch API
  const mockFetch: any = (url: string, options: any) => {
    t.is(url, 'https://example.com/hook-rejected')
    t.deepEqual(options, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TestRejected' }),
      signal: AbortSignal.timeout(3000)
    })
    return { ok: true }
  }

  // Mock the Store with actor-specific hook store
  const mockStore: any = {
    forActor: (actor: string) => {
      return {
        hooks: {
          get: async (hookType: string) => {
            if (hookType === 'onrejected') {
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

  t.true(result, 'Hook should be triggered successfully for onrejected')
})
