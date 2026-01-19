import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./ref', () => ({
  storageRef: vi.fn((_, initial) => ref(initial))
}))

vi.mock('./functions', () => ({
  oauthFunctions: {
    refresh: vi.fn()
  }
}))

import { oauthFunctions } from './functions'
import { OAuthStatus, OAuthType } from './models'
import { accessToken, error, errorDescription, hasError, isAuthorized, isExpiredToken, status, token, type } from './token'

describe('token', () => {
  const MOCK_NOW = 1000000000000 // A fixed timestamp

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_NOW)
    token.value = {}
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isExpiredToken', () => {
    it('should return false if token is undefined', () => {
      expect(isExpiredToken(undefined)).toBe(false)
    })

    it('should return false if token has no expires field', () => {
      expect(isExpiredToken({ access_token: 'abc' })).toBe(false)
    })

    it('should return true if token is expired', () => {
      const expiredToken = { expires: MOCK_NOW - 1000 }
      expect(isExpiredToken(expiredToken)).toBe(true)
    })

    it('should return false if token is not expired', () => {
      const validToken = { expires: MOCK_NOW + 1000 }
      expect(isExpiredToken(validToken)).toBe(false)
    })
  })

  describe('computed properties', () => {
    it('type should return token type', () => {
      token.value = { type: OAuthType.AUTHORIZATION_CODE }
      expect(type.value).toBe(OAuthType.AUTHORIZATION_CODE)
    })

    it('accessToken should return formatted access token', () => {
      token.value = { token_type: 'Bearer', access_token: 'test-secret' }
      expect(accessToken.value).toBe('Bearer test-secret')
    })

    it('accessToken should return undefined if missing data', () => {
      token.value = { access_token: 'test-secret' }
      expect(accessToken.value).toBeUndefined()
    })

    it('status should return AUTHORIZED when valid', () => {
      token.value = { access_token: 'valid', expires: MOCK_NOW + 1000 }
      expect(status.value).toBe(OAuthStatus.AUTHORIZED)
    })

    it('status should return DENIED when error exists', () => {
      token.value = { error: 'invalid_grant' }
      expect(status.value).toBe(OAuthStatus.DENIED)
    })

    it('status should return NOT_AUTHORIZED when no token', () => {
      token.value = {}
      expect(status.value).toBe(OAuthStatus.NOT_AUTHORIZED)
    })

    it('isAuthorized should be true only when status is AUTHORIZED', () => {
      token.value = { access_token: 'valid', expires: MOCK_NOW + 1000 }
      expect(isAuthorized.value).toBe(true)

      token.value = {}
      expect(isAuthorized.value).toBe(false)
    })

    it('error, hasError, errorDescription should map correctly', () => {
      token.value = { error: 'err', error_description: 'desc' }
      expect(error.value).toBe('err')
      expect(hasError.value).toBe(true)
      expect(errorDescription.value).toBe('desc')
    })
  })

  describe('watcher', () => {
    it('should set expires when expires_in is present and expires is missing', async () => {
      token.value = { expires_in: 3600 }

      await vi.runAllTimersAsync()

      expect(token.value.expires).toBe(MOCK_NOW + 3600 * 1000)
    })

    it('should refresh token when expired', async () => {
      const refreshedToken = {
        access_token: 'new-token',
        expires_in: 3600,
        type: OAuthType.AUTHORIZATION_CODE
      }
      vi.mocked(oauthFunctions.refresh).mockResolvedValue(refreshedToken)

      token.value = {
        access_token: 'old-token',
        expires_in: 3600,
        expires: MOCK_NOW - 1000
      }

      await vi.runAllTimersAsync()

      expect(oauthFunctions.refresh).toHaveBeenCalled()
      expect(token.value.access_token).toBe('new-token')
    })

    it('should not refresh if no expires_in', async () => {
      token.value = { access_token: 'token', expires: MOCK_NOW - 1000 }

      await vi.runAllTimersAsync()

      expect(oauthFunctions.refresh).not.toHaveBeenCalled()
    })
  })
})
