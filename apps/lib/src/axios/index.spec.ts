import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { createOAuth, registerOAuthCleanup } from '../test-utils'
import type { OAuth } from '../types'
import { createAxiosClient, createAxiosInterceptors, useOAuthHttp } from './index'

registerOAuthCleanup()

const request = (url: string) => ({ url, headers: { set: jest.fn() } }) as any

const requestHandlers = (client: { interceptors: { request: unknown } }) =>
  (client.interceptors.request as any).handlers.map((h: any) => h.fulfilled)

describe('axios adapter', () => {
  let oauth: OAuth
  let refresh: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    refresh = jest.fn()
    oauth = createOAuth({ ignorePaths: [/public/], functions: { refresh } })
  })

  describe('authorizationInterceptor', () => {
    it('sets the bearer header', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }
      const { authorizationInterceptor } = createAxiosInterceptors(oauth)

      const req = request('/api/orders')
      await authorizationInterceptor(req)

      expect(req.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer at')
    })

    it('refreshes an expired token first', async () => {
      refresh.mockResolvedValue({ access_token: 'fresh', token_type: 'Bearer', expires_in: 60 })
      oauth.typeConfig.value = { tokenPath: '/t', clientId: 'c' }
      oauth.token.value = { access_token: 'stale', token_type: 'Bearer', refresh_token: 'r', expires: Date.now() - 10_000 }
      const { authorizationInterceptor } = createAxiosInterceptors(oauth)

      const req = request('/api/orders')
      await authorizationInterceptor(req)

      expect(refresh).toHaveBeenCalled()
      expect(req.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer fresh')
    })

    it('skips ignored paths', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }
      const { authorizationInterceptor } = createAxiosInterceptors(oauth)

      const req = request('/api/public/products')
      await authorizationInterceptor(req)

      expect(req.headers.set).not.toHaveBeenCalled()
    })

    it('leaves the request untouched without a token', async () => {
      const { authorizationInterceptor } = createAxiosInterceptors(oauth)

      const req = request('/api/orders')
      await authorizationInterceptor(req)

      expect(req.headers.set).not.toHaveBeenCalled()
    })
  })

  describe('unauthorizedInterceptor', () => {
    it('persists the 401 response body as token and re-rejects', async () => {
      oauth.token.value = { access_token: 'at' }
      const { unauthorizedInterceptor } = createAxiosInterceptors(oauth)
      const error = { response: { status: 401, data: { error: 'invalid_token' } } }

      expect(unauthorizedInterceptor(error)).rejects.toBe(error)
      expect(oauth.token.value).toEqual({ error: 'invalid_token' })
    })

    it('clears the session when the 401 body is not an object', async () => {
      oauth.token.value = { access_token: 'at' }
      const { unauthorizedInterceptor } = createAxiosInterceptors(oauth)
      const error = { response: { status: 401, data: '<html>nope</html>' } }

      expect(unauthorizedInterceptor(error)).rejects.toBe(error)
      expect(oauth.token.value).toEqual({})
      expect(oauth.hasError.value).toBe(false)
    })

    it('ignores other errors', async () => {
      const initial = { access_token: 'at' }
      oauth.token.value = initial
      const { unauthorizedInterceptor } = createAxiosInterceptors(oauth)
      const error = { response: { status: 500, data: 'boom' } }

      expect(unauthorizedInterceptor(error)).rejects.toBe(error)
      expect(oauth.token.value).toEqual(initial)
    })
  })

  describe('createAxiosClient', () => {
    it('attaches both interceptors and defaults to json', () => {
      const client = createAxiosClient(oauth)

      expect(client.defaults.headers['Content-Type']).toBe('application/json')
      expect((client.interceptors.request as any).handlers).toHaveLength(1)
      expect((client.interceptors.response as any).handlers).toHaveLength(1)
    })

    it('lets caller defaults win', () => {
      const client = createAxiosClient(oauth, { baseURL: 'https://api.io', headers: { 'Content-Type': 'application/xml' } })

      expect(client.defaults.baseURL).toBe('https://api.io')
      expect(client.defaults.headers['Content-Type']).toBe('application/xml')
    })

    it('builds a separate client per instance, so no bearer crosses requests', () => {
      const other = createOAuth({ functions: { refresh: jest.fn() } })

      expect(createAxiosClient(oauth)).not.toBe(createAxiosClient(other))
    })
  })

  describe('useOAuthHttp', () => {
    // this entry reaches the root by package name so the bundler keeps it external. If that ever inlined
    // a second copy of the module pointer, the composable would answer with an instance nobody created —
    // and this is the test that notices
    it('resolves the active instance and attaches the interceptors', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }
      const client = useOAuthHttp()

      const req = request('/api/orders')
      await (client.interceptors.request as any).handlers[0].fulfilled(req)

      expect(req.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer at')
    })

    // the contract consumers build on: interceptors registered from one store or component must be seen by
    // every other call site. A fresh client per call would drop them silently — no error, just gone
    it('answers every call site with the same client, so added interceptors stay visible', () => {
      const mine = jest.fn(req => req)
      useOAuthHttp().interceptors.request.use(mine)

      const elsewhere = useOAuthHttp()

      expect(elsewhere).toBe(useOAuthHttp())
      expect(requestHandlers(elsewhere)).toContain(mine)
    })

    it('keeps one client per instance, so concurrent renders cannot cross interceptors', () => {
      const mine = jest.fn(req => req)
      const mineClient = useOAuthHttp()
      mineClient.interceptors.request.use(mine)

      // a second live instance makes the server-side pointer ambiguous on purpose; stub a window so the
      // composable resolves the last-created instance the way it would in a browser
      const realWindow = globalThis.window
      globalThis.window = {} as any
      try {
        createOAuth({ functions: { refresh: jest.fn() } })
        const otherClient = useOAuthHttp()

        expect(otherClient).not.toBe(mineClient)
        expect(requestHandlers(otherClient)).not.toContain(mine)
      } finally {
        globalThis.window = realWindow
      }
    })
  })
})
