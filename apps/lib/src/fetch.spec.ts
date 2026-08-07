import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import { createOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

import type { OAuth } from './types'

const realFetch = globalThis.fetch

// the init the transport actually handed the platform — headers normalized to a plain object
const sent = (mock: jest.Mock, call = 0) => {
  const [, init] = mock.mock.calls[call]
  return { ...init, headers: Object.fromEntries(new Headers(init.headers)) }
}

const respond = (status: number, body?: any, type = 'application/json') =>
  new Response((body !== undefined && JSON.stringify(body)) || null, { status, headers: { 'Content-Type': type } })

describe('fetch transport', () => {
  let oauth: OAuth
  let refresh: jest.Mock
  let fetchMock: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    refresh = jest.fn()
    fetchMock = jest.fn().mockResolvedValue(respond(200, { ok: true }))
    globalThis.fetch = fetchMock as any
    oauth = createOAuth({
      ignorePaths: [/public/],
      functions: { refresh }
    })
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  describe('authHeaders', () => {
    it('returns the bearer', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      expect(await oauth.authHeaders('/api/orders')).toEqual({ Authorization: 'Bearer at' })
    })

    it('refreshes an expired token first', async () => {
      refresh.mockResolvedValue({ access_token: 'fresh', token_type: 'Bearer', expires_in: 60 })
      oauth.typeConfig.value = { tokenPath: '/t', clientId: 'c' }
      oauth.token.value = { access_token: 'stale', token_type: 'Bearer', refresh_token: 'r', expires: Date.now() - 10_000 }

      expect(await oauth.authHeaders('/api/orders')).toEqual({ Authorization: 'Bearer fresh' })
      expect(refresh).toHaveBeenCalled()
    })

    it('is empty for an ignored path, without even checking the token', async () => {
      oauth.token.value = { access_token: 'stale', token_type: 'Bearer', refresh_token: 'r', expires: Date.now() - 10_000 }

      expect(await oauth.authHeaders('/api/public/products')).toEqual({})
      expect(refresh).not.toHaveBeenCalled()
    })

    it('is empty without a token', async () => {
      expect(await oauth.authHeaders('/api/orders')).toEqual({})
    })
  })

  describe('fetch', () => {
    it('attaches the bearer', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      await oauth.fetch('/api/orders')

      expect(sent(fetchMock).headers.authorization).toBe('Bearer at')
    })

    it('skips ignored paths', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      await oauth.fetch('/api/public/products')

      expect(sent(fetchMock).headers.authorization).toBeUndefined()
    })

    it('reads the url from a URL and from a Request', async () => {
      oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

      await oauth.fetch(new URL('https://api.io/public/products'))
      await oauth.fetch(new Request('https://api.io/public/products'))

      expect(sent(fetchMock, 0).headers.authorization).toBeUndefined()
      expect(sent(fetchMock, 1).headers.authorization).toBeUndefined()
    })

    it('asks for json back on every request', async () => {
      await oauth.fetch('/api/orders')

      expect(sent(fetchMock).headers.accept).toBe('application/json')
    })

    it('labels a string body as json', async () => {
      await oauth.fetch('/api/orders', { method: 'POST', body: JSON.stringify({ id: 1 }) })

      expect(sent(fetchMock).headers['content-type']).toBe('application/json')
    })

    it('leaves a typed body to carry its own content type', async () => {
      const body = new FormData()
      body.set('file', 'x')

      await oauth.fetch('/api/orders', { method: 'POST', body })

      expect(sent(fetchMock).headers['content-type']).toBeUndefined()
    })

    it('does not override a content type the caller set', async () => {
      await oauth.fetch('/api/orders', { method: 'POST', body: '<xml/>', headers: { 'Content-Type': 'application/xml' } })

      expect(sent(fetchMock).headers['content-type']).toBe('application/xml')
    })

    it('persists a 401 body as the token', async () => {
      oauth.token.value = { access_token: 'at' }
      fetchMock.mockResolvedValue(respond(401, { error: 'invalid_token' }))

      await oauth.fetch('/api/orders')

      expect(oauth.token.value).toEqual({ error: 'invalid_token' })
    })

    it('clears the session on a 401 with no usable body', async () => {
      oauth.token.value = { access_token: 'at' }
      fetchMock.mockResolvedValue(respond(401, undefined, 'text/html'))

      await oauth.fetch('/api/orders')

      expect(oauth.token.value).toEqual({})
      expect(oauth.hasError.value).toBe(false)
    })

    it('leaves the 401 body readable by the caller', async () => {
      fetchMock.mockResolvedValue(respond(401, { error: 'invalid_token' }))

      const response = await oauth.fetch('/api/orders')

      expect(await response.json()).toEqual({ error: 'invalid_token' })
    })

    it('leaves the token alone on other statuses', async () => {
      const initial = { access_token: 'at' }
      oauth.token.value = initial
      fetchMock.mockResolvedValue(respond(500, { error: 'boom' }))

      await oauth.fetch('/api/orders')

      expect(oauth.token.value).toEqual(initial)
    })
  })
})
