import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { nextTick } from 'vue'
import { createOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

import type { OAuth } from './types'

// bun test provides no localStorage of its own — install a deterministic mock instead of relying
// on another spec file's module-load mock leaking in (load order is not a contract)
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  }
} as Storage

const flush = async () => {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const idToken = (payload: object) => `header.${btoa(JSON.stringify(payload))}.sig`

describe('user', () => {
  let oauth: OAuth
  let userInfo: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    userInfo = jest.fn()
    oauth = createOAuth({ functions: { refresh: jest.fn(), userInfo } })
  })

  it('derives the user from the id_token claims', async () => {
    oauth.token.value = { id_token: idToken({ name: 'Jane', email: 'jane@acme.io' }) }

    await flush()

    expect(oauth.user.value).toMatchObject({ name: 'Jane', email: 'jane@acme.io' })
  })

  it('fetches userinfo once authorized and a userPath is configured', async () => {
    userInfo.mockResolvedValue({ name: 'From Endpoint' })
    oauth.typeConfig.value = { userPath: '/userinfo' }
    oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

    await flush()

    expect(userInfo).toHaveBeenCalledWith(oauth.typeConfig.value, oauth.fetch)
    expect(oauth.user.value).toEqual({ name: 'From Endpoint' })
  })

  it('fetches userinfo on creation with a stored token and a static userPath', async () => {
    userInfo.mockResolvedValue({ name: 'Restored' })
    // token already in storage + userPath configured up front: neither watch source ever changes
    globalThis.localStorage?.setItem('token', JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires: Date.now() + 60_000 }))
    const restored = createOAuth({ functions: { refresh: jest.fn(), userInfo }, config: { userPath: '/userinfo' } as any })

    await flush()

    expect(userInfo).toHaveBeenCalled()
    expect(restored.user.value).toEqual({ name: 'Restored' })
  })

  it('does not fetch userinfo without a userPath', async () => {
    oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

    await flush()

    expect(userInfo).not.toHaveBeenCalled()
  })

  it('keeps user state isolated between instances', async () => {
    oauth.token.value = { id_token: idToken({ name: 'Jane' }) }
    // own storageKey: instances sharing a key legitimately share the persisted token
    const second = createOAuth({ storageKey: 'second.token', functions: { refresh: jest.fn() } })

    await flush()

    expect(oauth.user.value).toMatchObject({ name: 'Jane' })
    expect(second.user.value).toBeUndefined()
  })
})
