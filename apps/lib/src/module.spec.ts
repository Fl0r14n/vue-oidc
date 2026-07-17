import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createApp } from 'vue'
import { createOAuth, getActiveOAuth } from './module'
import type { OAuth } from './types'

describe('active instance resolution', () => {
  const instances: OAuth[] = []
  const create = () => {
    const instance = createOAuth()
    instances.push(instance)
    return instance
  }

  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  afterEach(() => {
    // dispose everything a test created — the alive-instance count drives ambiguity detection
    instances.splice(0).forEach(i => {
      i.dispose()
    })
  })

  it('falls back to the pointer while it is unambiguous (single instance alive)', () => {
    const only = create()

    expect(getActiveOAuth()).toBe(only)
  })

  it('throws on the pointer when multiple instances are alive on the server', () => {
    const first = create()
    const second = create()

    // no injection context, two candidates: answering could cross requests under SSR
    expect(() => getActiveOAuth()).toThrow('ambiguous')

    first.dispose()
    expect(getActiveOAuth()).toBe(second)
  })

  it('resolves through the injection context ahead of the pointer', () => {
    const injected = create()
    const app = createApp({})
    app.use(injected)

    create() // module pointer now points elsewhere — and the pointer alone would be ambiguous

    // pinia store setups and router guards run inside app.runWithContext — inject must win there
    expect(app.runWithContext(() => getActiveOAuth())).toBe(injected)
  })

  it('throws when no instance exists', () => {
    expect(() => getActiveOAuth()).toThrow('[vue-oidc]')
  })

  it('dispose clears the pointer only if it points to the disposed instance', () => {
    const first = create()
    const second = create()

    first.dispose()
    expect(getActiveOAuth()).toBe(second)

    second.dispose()
    expect(() => getActiveOAuth()).toThrow('[vue-oidc]')
  })
})
