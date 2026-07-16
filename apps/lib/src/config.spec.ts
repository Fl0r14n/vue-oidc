import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { defaultOAuthFunctions } from './functions'
import { createOAuth } from './module'

describe('config', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('applies defaults', () => {
    const oauth = createOAuth()

    expect(oauth.storageKey.value).toBe('token')
    expect(oauth.ignoredPaths.value).toEqual([])
    expect(oauth.config.value.strictJwt).toBe(true)
  })

  it('merges the given config over the defaults', () => {
    const oauth = createOAuth({
      storageKey: 'custom',
      strictJwt: false,
      config: { clientId: 'c', tokenPath: '/t' }
    })

    expect(oauth.storageKey.value).toBe('custom')
    expect(oauth.config.value.strictJwt).toBe(false)
    expect(oauth.typeConfig.value).toEqual({ clientId: 'c', tokenPath: '/t' })
  })

  it('typeConfig setter merges instead of replacing', () => {
    const oauth = createOAuth({ config: { clientId: 'c' } })

    oauth.typeConfig.value = { tokenPath: '/t' }

    expect(oauth.typeConfig.value).toEqual({ clientId: 'c', tokenPath: '/t' })
  })

  it('merges functions overrides over the defaults', () => {
    const refresh = jest.fn()
    const oauth = createOAuth({ functions: { refresh } })

    expect(oauth.functions.refresh).toBe(refresh)
    expect(oauth.functions.revoke).toBe(defaultOAuthFunctions.revoke)
  })

  it('keeps config isolated between instances', () => {
    const first = createOAuth({ config: { clientId: 'first' } })
    const second = createOAuth({ config: { clientId: 'second' } })

    expect(first.typeConfig.value?.clientId).toBe('first')
    expect(second.typeConfig.value?.clientId).toBe('second')
  })
})
