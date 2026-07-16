import { beforeEach, describe, expect, it, jest, mock } from 'bun:test'

mock.module('./functions', () => ({
  oauthFunctions: {
    refresh: jest.fn(),
    openIdConfiguration: jest.fn()
  }
}))

import { config } from './config'
import { oauthFunctions } from './functions'
import { checkToken, status, token } from './token'
import { OAuthStatus, OAuthType } from './types'

const refresh = oauthFunctions.refresh as jest.Mock

describe('checkToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    token.value = {}
    config.value = { tokenPath: '/t', clientId: 'c' }
  })

  it('refreshes an expired token and keeps the refresh_token', async () => {
    refresh.mockResolvedValue({ access_token: 'fresh', expires_in: 60 })
    token.value = { refresh_token: 'keep', access_token: 'stale', expires: Date.now() - 10_000 }

    await checkToken()

    expect(refresh).toHaveBeenCalled()
    expect(token.value.access_token).toBe('fresh')
    expect(token.value.refresh_token).toBe('keep')
    expect(token.value.expires).toBeGreaterThan(Date.now())
  })

  it('persists the RFC 6749 error body when the refresh token is rejected (invalid_grant)', async () => {
    refresh.mockResolvedValue({ error: 'invalid_grant', error_description: 'Invalid refresh token', type: OAuthType.AUTHORIZATION_CODE })
    token.value = { refresh_token: 'dead', access_token: 'stale', token_type: 'Bearer', expires: Date.now() - 10_000 }

    await checkToken()

    expect(token.value).toEqual({ error: 'invalid_grant', error_description: 'Invalid refresh token', type: OAuthType.AUTHORIZATION_CODE })
    expect(status.value).toBe(OAuthStatus.DENIED)
  })

  it('keeps the old token when refresh yields neither a fresh token nor an error (transient failure)', async () => {
    refresh.mockResolvedValue(undefined)
    const stale = { refresh_token: 'keep', access_token: 'stale', expires: Date.now() - 10_000 }
    token.value = stale

    await checkToken()

    expect(token.value).toEqual(stale)
  })

  it('does not refresh a token that is not expired', async () => {
    token.value = { access_token: 'live', expires: Date.now() + 60_000 }

    await checkToken()

    expect(refresh).not.toHaveBeenCalled()
  })
})
