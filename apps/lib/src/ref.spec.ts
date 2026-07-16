import { beforeEach, describe, expect, it } from 'bun:test'
import { nextTick, ref } from 'vue'
import { storageRef } from './ref'

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

describe('storageRef', () => {
  beforeEach(() => {
    store.clear()
  })

  it('should exist', () => {
    expect(storageRef).toBeDefined()
  })

  it('should be a function', () => {
    expect(typeof storageRef).toBe('function')
  })

  it('persists model changes under a static key', async () => {
    const model = storageRef<any>('static.token', {})
    model.value = { access_token: 'a' }
    await nextTick()
    expect(JSON.parse(store.get('static.token') || 'null')).toEqual({ access_token: 'a' })
  })

  it('reads the stored value when the key changes', async () => {
    store.set('site.token', JSON.stringify({ access_token: 'site' }))
    const key = ref('token')
    const model = storageRef<any>(key, {})
    key.value = 'site.token'
    await nextTick()
    expect(model.value).toEqual({ access_token: 'site' })
  })

  it('does not write to the previous key after the key changes', async () => {
    store.set('site.token', JSON.stringify({ access_token: 'site' }))
    const key = ref('token')
    const model = storageRef<any>(key, {})
    await nextTick()

    key.value = 'site.token'
    await nextTick()
    expect(store.get('token')).toBeUndefined()

    model.value = { access_token: 'updated' }
    await nextTick()
    expect(store.get('token')).toBeUndefined()
    expect(JSON.parse(store.get('site.token') || 'null')).toEqual({ access_token: 'updated' })
  })
})
