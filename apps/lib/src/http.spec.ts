import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { createOAuth } from './module'
import type { OAuthInstance } from './types'

const request = (url: string) =>
  ({
    url,
    headers: { setAuthorization: jest.fn() }
  }) as any

describe('http interceptors', () => {
  let oauth: OAuthInstance
  let refresh: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    refresh = jest.fn()
    oauth = createOAuth({
      ignorePaths: [/public/],
      functions: { refresh }
    })
  })

  describe('authorizationInterceptor', () => {
    it('attaches the access token', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      const req = request('/api/orders')
      await oauth.authorizationInterceptor(req)

      expect(req.headers.setAuthorization).toHaveBeenCalledWith('Bearer at')
    })

    it('refreshes an expired token before attaching it', async () => {
      refresh.mockResolvedValue({ access_token: 'fresh', token_type: 'Bearer', expires_in: 60 })
      oauth.typeConfig.value = { tokenPath: '/t', clientId: 'c' }
      oauth.token.value = { access_token: 'stale', token_type: 'Bearer', refresh_token: 'r', expires: Date.now() - 10_000 }

      const req = request('/api/orders')
      await oauth.authorizationInterceptor(req)

      expect(refresh).toHaveBeenCalled()
      expect(req.headers.setAuthorization).toHaveBeenCalledWith('Bearer fresh')
    })

    it('skips ignored paths', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      const req = request('/api/public/products')
      await oauth.authorizationInterceptor(req)

      expect(req.headers.setAuthorization).not.toHaveBeenCalled()
    })

    it('leaves the request untouched without a token', async () => {
      const req = request('/api/orders')
      await oauth.authorizationInterceptor(req)

      expect(req.headers.setAuthorization).not.toHaveBeenCalled()
    })
  })

  describe('unauthorizedInterceptor', () => {
    it('persists the 401 response body as token', async () => {
      oauth.token.value = { access_token: 'at' }
      const error = { response: { status: 401, data: { error: 'invalid_token' } } }

      expect(oauth.unauthorizedInterceptor(error)).rejects.toBe(error)
      expect(oauth.token.value).toEqual({ error: 'invalid_token' })
    })

    it('ignores other errors', async () => {
      const initial = { access_token: 'at' }
      oauth.token.value = initial
      const error = { response: { status: 500, data: 'boom' } }

      expect(oauth.unauthorizedInterceptor(error)).rejects.toBe(error)
      expect(oauth.token.value).toEqual(initial)
    })
  })
})
