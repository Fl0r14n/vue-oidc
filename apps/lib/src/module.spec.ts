import { beforeEach, describe, expect, it } from 'bun:test'
import { createApp } from 'vue'
import { createOAuth, disposeOAuth, getActiveOAuth, useOAuth } from './module'
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

describe('useOAuth surface', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  // `checkToken` was missing here while `autoconfigOauth` — a lower-level primitive —
  // was exposed, so a consumer that needed to await a refresh before reading
  // `isAuthorized` had to reach for `getActiveOAuth()`, the escape hatch documented
  // for use *outside* an injection context. Guarded so the composable cannot drift
  // from the instance again.
  it('exposes every member of the instance a component is expected to reach for', () => {
    const { run } = installOAuth()
    const api = run(() => useOAuth())

    for (const member of [
      'config',
      'storageKey',
      'ignorePath',
      'type',
      'accessToken',
      'status',
      'isAuthorized',
      'error',
      'hasError',
      'errorDescription',
      'state',
      'login',
      'logout',
      'oauthCallback',
      'isExpiredToken',
      'autoconfigOauth',
      'checkToken'
    ]) {
      expect(api).toHaveProperty(member)
    }
  })

  it('checkToken resolves and shares one in-flight promise across callers', async () => {
    const { run } = installOAuth()
    const { checkToken } = run(() => useOAuth())

    const first = checkToken()
    const second = checkToken()

    expect(second).toBe(first)
    await expect(first).resolves.toBeUndefined()
  })
})

describe('disposeOAuth', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  // The one operation that genuinely needs an instance recovered *from an app*: an SSR
  // host holds the app it was handed, not the instance a factory created and discarded.
  it('disposes the instance installed in the app it is handed, and only that one', () => {
    const a = installOAuth()
    const b = installOAuth()

    let disposedA = 0
    let disposedB = 0
    const stopA = a.oauth.dispose
    const stopB = b.oauth.dispose
    a.oauth.dispose = () => {
      disposedA++
      stopA()
    }
    b.oauth.dispose = () => {
      disposedB++
      stopB()
    }

    disposeOAuth(a.app)

    expect(disposedA).toBe(1)
    expect(disposedB).toBe(0)
    expect(b.run(() => getActiveOAuth())).toBe(b.oauth)
  })
})
