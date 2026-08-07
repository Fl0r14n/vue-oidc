import { beforeEach, describe, expect, it } from 'bun:test'
import { createApp } from 'vue'
import { createOAuth, getActiveOAuth } from './module'
import { installOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

describe('active instance resolution', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('resolves the instance provided to the current injection context', () => {
    const { oauth, run } = installOAuth()

    expect(run(() => getActiveOAuth())).toBe(oauth)
  })

  it('keeps concurrent instances apart — each context answers with its own', () => {
    const a = installOAuth()
    const b = installOAuth()

    expect(a.run(() => getActiveOAuth())).toBe(a.oauth)
    expect(b.run(() => getActiveOAuth())).toBe(b.oauth)
  })

  // the whole point of having no module-level pointer: an unresolvable call site fails the same way
  // everywhere and on its first run, instead of quietly answering with another request's instance
  it('throws outside any injection context, even with an instance installed', () => {
    installOAuth()

    expect(() => getActiveOAuth()).toThrow('[vue-oidc]: no OAuth instance in this injection context')
  })

  it('throws inside a context that has no instance installed', () => {
    createOAuth() // created but never installed — providing nothing to this app
    const bare = createApp({ render: () => null })

    expect(() => bare.runWithContext(() => getActiveOAuth())).toThrow('[vue-oidc]')
  })

  it('dispose stops the instance without touching resolution for anyone else', () => {
    const a = installOAuth()
    const b = installOAuth()

    a.oauth.dispose()

    expect(b.run(() => getActiveOAuth())).toBe(b.oauth)
  })
})
