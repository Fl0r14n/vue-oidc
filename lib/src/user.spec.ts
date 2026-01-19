import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

// Mock dependencies before importing the module under test
vi.mock('./config', () => ({
  config: ref({}),
  ignoredPaths: ref([])
}))

vi.mock('./token', () => ({
  token: ref({}),
  accessToken: ref(undefined),
  isAuthorized: ref(false),
  isExpiredToken: vi.fn(() => false)
}))

vi.mock('./functions', () => ({
  oauthFunctions: {
    refresh: vi.fn(),
    userInfo: vi.fn()
  }
}))

import type { Ref } from 'vue'
import { config, ignoredPaths } from './config'
import { oauthFunctions } from './functions'
import { accessToken, isAuthorized, isExpiredToken, token } from './token'
import { authorizationInterceptor, http, jwt, unauthorizedInterceptor, user } from './user'

describe('user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(user as Ref<any>).value = undefined
    ;(token as Ref<any>).value = {}
    ;(accessToken as Ref<any>).value = undefined
    ;(isAuthorized as Ref<any>).value = false
    ;(ignoredPaths as Ref<any>).value = []
    ;(config as Ref<any>).value = {}
  })

  describe('jwt', () => {
    it('should decode a valid JWT payload', () => {
      const payload = { sub: '123', name: 'John Doe' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const mockJwt = `header.${encodedPayload}.signature`

      expect(jwt(mockJwt)).toEqual(payload)
    })

    it('should return empty object for invalid JWT', () => {
      expect(jwt('invalid')).toEqual({})
      expect(jwt(undefined)).toEqual({})
    })

    it('should handle UTF-8 characters in JWT', () => {
      const payload = { name: 'Jöhn Døe' }
      // Note: atob/btoa handle Latin1. JWT uses base64url which typically encodes UTF-8.
      // The implementation in user.ts uses decodeURIComponent(atob...) pattern for UTF-8.
      const json = JSON.stringify(payload)
      const bytes = new TextEncoder().encode(json)
      const base64 = btoa(String.fromCharCode(...bytes))
      const mockJwt = `header.${base64}.signature`

      expect(jwt(mockJwt)).toEqual(payload)
    })
  })

  describe('authorizationInterceptor', () => {
    it('should add Authorization header if token is valid and not ignored', async () => {
      ;(accessToken as Ref<any>).value = 'Bearer secret'
      const req = {
        url: '/api/data',
        headers: {
          setAuthorization: vi.fn()
        }
      } as any

      await authorizationInterceptor(req)
      expect(req.headers.setAuthorization).toHaveBeenCalledWith('Bearer secret')
    })

    it('should refresh token if expired', async () => {
      vi.mocked(isExpiredToken).mockReturnValue(true)
      const oldToken = { access_token: 'old' }
      const newToken = { access_token: 'new' }
      ;(token as Ref<any>).value = oldToken
      ;(config as Ref<any>).value = { clientId: 'client' }
      vi.mocked(oauthFunctions.refresh).mockResolvedValue(newToken)

      const req = {
        url: '/api/data',
        headers: { setAuthorization: vi.fn() }
      } as any

      await authorizationInterceptor(req)

      expect(oauthFunctions.refresh).toHaveBeenCalledWith(oldToken, (config as Ref<any>).value)
      expect((token as Ref<any>).value).toEqual(newToken)
    })

    it('should skip Authorization header if path is ignored', async () => {
      ;(ignoredPaths as Ref<any>).value = [/^\/public/]
      ;(accessToken as Ref<any>).value = 'Bearer secret'
      const req = {
        url: '/public/info',
        headers: { setAuthorization: vi.fn() }
      } as any

      await authorizationInterceptor(req)
      expect(req.headers.setAuthorization).not.toHaveBeenCalled()
    })
  })

  describe('unauthorizedInterceptor', () => {
    it('should update token and reject error on 401', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: 'unauthorized' }
        }
      }

      await expect(unauthorizedInterceptor(error)).rejects.toEqual(error)
      expect((token as Ref<any>).value).toEqual({ error: 'unauthorized' })
    })

    it('should only reject error for non-401', async () => {
      const error = {
        response: { status: 500 }
      }
      const initialToken = { access_token: 'valid' }
      ;(token as Ref<any>).value = initialToken

      await expect(unauthorizedInterceptor(error)).rejects.toEqual(error)
      expect((token as Ref<any>).value).toEqual(initialToken)
    })
  })

  describe('user watcher', () => {
    it('should update user when id_token changes', async () => {
      const payload = { sub: 'user123' }
      const encoded = btoa(JSON.stringify(payload))
      ;(token as Ref<any>).value = { id_token: `header.${encoded}.sig` }

      await nextTick()
      expect(user.value).toEqual(payload)
    })

    it('should fetch user info when authorized and userPath is set', async () => {
      ;(config as Ref<any>).value = { userPath: '/api/me' }
      const mockUserInfo = { sub: '123', email: 'test@example.com' }
      vi.mocked(oauthFunctions.userInfo).mockResolvedValue(mockUserInfo)
      ;(isAuthorized as Ref<any>).value = true
      await nextTick()

      expect(oauthFunctions.userInfo).toHaveBeenCalledWith('/api/me', http)
      expect(user.value).toEqual(mockUserInfo)
    })
  })
})
