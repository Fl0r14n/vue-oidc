import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { createOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

import { OAuthStatus, OAuthType } from './core/types'
import type { OAuth } from './types'

describe('checkToken', () => {
  let oauth: OAuth
  let refresh: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    refresh = jest.fn()
    oauth = createOAuth({
      config: { tokenPath: '/t', clientId: 'c' },
      functions: { refresh, openIdConfiguration: jest.fn() }
    })
  })

  it('refreshes an expired token and keeps the refresh_token', async () => {
    refresh.mockResolvedValue({ access_token: 'fresh', expires_in: 60 })
    oauth.token.value = { refresh_token: 'keep', access_token: 'stale', expires: Date.now() - 10_000 }

    await oauth.checkToken()

    expect(refresh).toHaveBeenCalled()
    expect(oauth.token.value.access_token).toBe('fresh')
    expect(oauth.token.value.refresh_token).toBe('keep')
    expect(oauth.token.value.expires).toBeGreaterThan(Date.now())
  })

  it('persists the RFC 6749 error body when the refresh token is rejected (invalid_grant)', async () => {
    refresh.mockResolvedValue({ error: 'invalid_grant', error_description: 'Invalid refresh token', type: OAuthType.AUTHORIZATION_CODE })
    oauth.token.value = { refresh_token: 'dead', access_token: 'stale', token_type: 'Bearer', expires: Date.now() - 10_000 }

    await oauth.checkToken()

    expect(oauth.token.value).toEqual({
      error: 'invalid_grant',
      error_description: 'Invalid refresh token',
      type: OAuthType.AUTHORIZATION_CODE
    })
    expect(oauth.status.value).toBe(OAuthStatus.DENIED)
  })

  it('keeps the old token when refresh yields neither a fresh token nor an error (transient failure)', async () => {
    refresh.mockResolvedValue(undefined)
    const stale = { refresh_token: 'keep', access_token: 'stale', expires: Date.now() - 10_000 }
    oauth.token.value = stale

    await oauth.checkToken()

    expect(oauth.token.value).toEqual(stale)
  })

  it('does not refresh a token that is not expired', async () => {
    oauth.token.value = { access_token: 'live', expires: Date.now() + 60_000 }

    await oauth.checkToken()

    expect(refresh).not.toHaveBeenCalled()
  })

  it('isolates token state between instances', async () => {
    oauth.token.value = { access_token: 'first' }
    const second = createOAuth({ storageKey: 'other', functions: { refresh: jest.fn() } })

    expect(second.token.value).toEqual({})
    expect(oauth.token.value.access_token).toBe('first')
  })
})
