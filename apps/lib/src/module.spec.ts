import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createOAuth, getActiveOAuth, setActiveOAuth, setOAuthResolver } from './module'

describe('active instance resolution', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  afterEach(() => {
    setOAuthResolver(undefined)
    setActiveOAuth(undefined)
  })

  it('falls back to the last created instance', () => {
    const first = createOAuth()
    const second = createOAuth()

    expect(getActiveOAuth()).toBe(second)
    expect(getActiveOAuth()).not.toBe(first)
  })

  it('prefers the resolver over the module-level pointer', () => {
    const pointed = createOAuth()
    const resolved = createOAuth()
    setActiveOAuth(pointed)
    setOAuthResolver(() => resolved)

    expect(getActiveOAuth()).toBe(resolved)
  })

  it('uses the pointer when the resolver yields nothing', () => {
    const pointed = createOAuth()
    setOAuthResolver(() => undefined)

    expect(getActiveOAuth()).toBe(pointed)
  })

  it('throws when no instance exists', () => {
    setActiveOAuth(undefined)

    expect(() => getActiveOAuth()).toThrow('[vue-oidc]')
  })

  it('dispose clears the pointer only if it points to the disposed instance', () => {
    const first = createOAuth()
    const second = createOAuth()

    first.dispose()
    expect(getActiveOAuth()).toBe(second)

    second.dispose()
    expect(() => getActiveOAuth()).toThrow('[vue-oidc]')
  })
})
