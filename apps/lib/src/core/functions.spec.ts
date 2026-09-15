import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import { defaultOAuthFunctions } from './functions'
import { OAuthType } from './types'

const realFetch = globalThis.fetch

const respond = (status: number, body?: any) =>
  new Response((body !== undefined && JSON.stringify(body)) || null, { status, headers: { 'Content-Type': 'application/json' } })

describe('defaultOAuthFunctions', () => {
  let fetchMock: jest.Mock

  // the request the function actually made, with the form body decoded back to an object
  const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call]
    const headers = Object.fromEntries(new Headers(init?.headers))
    const body = (init?.body && Object.fromEntries(new URLSearchParams(init.body as any))) || undefined
    return { url, method: init?.method, headers, body }
  }

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(respond(200, {}))
    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  describe('form encoding', () => {
    it('posts form-encoded and asks for json', async () => {
      await defaultOAuthFunctions.clientCredentialLogin({ tokenPath: '/token', clientId: 'c', clientSecret: 's' })

      const { url, method, headers } = sent()
      expect(url).toBe('/token')
      expect(method).toBe('POST')
      expect(headers['content-type']).toBe('application/x-www-form-urlencoded')
      expect(headers.accept).toBe('application/json')
    })

    it('omits absent fields instead of sending the string "undefined"', async () => {
      await defaultOAuthFunctions.clientCredentialLogin({ tokenPath: '/token', clientId: 'c' })

      const { body } = sent()
      expect(body).toEqual({ client_id: 'c', grant_type: 'client_credentials' })
      expect(body).not.toHaveProperty('client_secret')
      expect(body).not.toHaveProperty('scope')
    })
  })

  describe('refresh', () => {
    it('exchanges the refresh token and carries the flow type over', async () => {
      fetchMock.mockResolvedValue(respond(200, { access_token: 'fresh', expires_in: 60 }))

      const token = await defaultOAuthFunctions.refresh(
        { refresh_token: 'r', type: OAuthType.AUTHORIZATION_CODE },
        { tokenPath: '/token', clientId: 'c', scope: 'openid' }
      )

      expect(sent().body).toEqual({ client_id: 'c', grant_type: 'refresh_token', refresh_token: 'r', scope: 'openid' })
      expect(token).toEqual({ access_token: 'fresh', expires_in: 60, type: OAuthType.AUTHORIZATION_CODE })
    })

    it('returns an RFC 6749 §5.2 error body rather than throwing on it', async () => {
      fetchMock.mockResolvedValue(respond(400, { error: 'invalid_grant' }))

      const token = await defaultOAuthFunctions.refresh({ refresh_token: 'r' }, { tokenPath: '/token', clientId: 'c' })

      expect(token).toMatchObject({ error: 'invalid_grant' })
    })

    it('returns the token untouched with nothing to refresh with', async () => {
      const initial = { access_token: 'at' }

      expect(await defaultOAuthFunctions.refresh(initial, { tokenPath: '/token', clientId: 'c' })).toBe(initial)
      expect(await defaultOAuthFunctions.refresh({ refresh_token: 'r' }, {})).toEqual({ refresh_token: 'r' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('keeps the old token when the network fails', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))
      const initial = { refresh_token: 'r' }

      expect(await defaultOAuthFunctions.refresh(initial, { tokenPath: '/token', clientId: 'c' })).toBe(initial)
    })
  })

  describe('revoke', () => {
    it('revokes both tokens, access first', async () => {
      await defaultOAuthFunctions.revoke({ access_token: 'at', refresh_token: 'rt' }, { revokePath: '/revoke', clientId: 'c' })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(sent(0).body).toMatchObject({ token: 'at', token_type_hint: 'access_token' })
      expect(sent(1).body).toMatchObject({ token: 'rt', token_type_hint: 'refresh_token' })
    })

    it('does not reject when the IdP rejects an already-invalid token', async () => {
      fetchMock.mockResolvedValue(respond(400, { error: 'invalid_token' }))

      expect(await defaultOAuthFunctions.revoke({ access_token: 'at' }, { revokePath: '/revoke' })).toBeUndefined()
    })

    it('does not reject when the network fails — a throw would strand the local logout', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      expect(await defaultOAuthFunctions.revoke({ access_token: 'at' }, { revokePath: '/revoke' })).toBeUndefined()
    })

    it('skips the call without a revokePath', async () => {
      await defaultOAuthFunctions.revoke({ access_token: 'at' }, {})

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('authorize', () => {
    it('exchanges the code, verifier included', async () => {
      fetchMock.mockResolvedValue(respond(200, { access_token: 'at' }))

      const token = await defaultOAuthFunctions.authorize(
        { code: 'c0de', redirect_uri: 'https://app.io/cb', code_verifier: 'v' },
        { tokenPath: '/token', clientId: 'c' }
      )

      expect(sent().body).toEqual({
        code: 'c0de',
        client_id: 'c',
        redirect_uri: 'https://app.io/cb',
        grant_type: 'authorization_code',
        code_verifier: 'v'
      })
      expect(token).toEqual({ access_token: 'at', type: OAuthType.AUTHORIZATION_CODE })
    })

    it('returns the token untouched without a code', async () => {
      const initial = { access_token: 'at' }

      expect(await defaultOAuthFunctions.authorize(initial, { tokenPath: '/token' })).toBe(initial)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('resourceOwnerLogin', () => {
    it('posts the credentials', async () => {
      fetchMock.mockResolvedValue(respond(200, { access_token: 'at' }))

      const token = await defaultOAuthFunctions.resourceOwnerLogin(
        { username: 'jane', password: 'pw' },
        { tokenPath: '/token', clientId: 'c' }
      )

      expect(sent().body).toEqual({ client_id: 'c', grant_type: 'password', username: 'jane', password: 'pw' })
      expect(token).toEqual({ access_token: 'at', type: OAuthType.RESOURCE })
    })

    it('needs both a tokenPath and a clientId', async () => {
      expect(
        await defaultOAuthFunctions.resourceOwnerLogin({ username: 'jane', password: 'pw' }, { tokenPath: '/token' } as any)
      ).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('openIdConfiguration', () => {
    // a `client_id` here is not in OIDC Discovery 1.0 §4.1, and Entra rejects the request outright
    it('gets the discovery document with no query parameters at all', async () => {
      fetchMock.mockResolvedValue(respond(200, { issuer: 'https://idp.io' }))

      const config = await defaultOAuthFunctions.openIdConfiguration({ issuerPath: 'https://idp.io', clientId: 'c' })

      expect(sent().url).toBe('https://idp.io/.well-known/openid-configuration')
      expect(sent().method).toBeUndefined()
      expect(config).toEqual({ issuer: 'https://idp.io' })
    })

    it('is undefined without an issuerPath, and when the request fails', async () => {
      expect(await defaultOAuthFunctions.openIdConfiguration({})).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()

      fetchMock.mockRejectedValue(new Error('offline'))
      expect(await defaultOAuthFunctions.openIdConfiguration({ issuerPath: 'https://idp.io' })).toBeUndefined()
    })
  })

  describe('userInfo', () => {
    it('uses the authorized fetch it is handed', async () => {
      const authorized = jest.fn().mockResolvedValue(respond(200, { sub: '42' }))

      const user = await defaultOAuthFunctions.userInfo({ userPath: '/userinfo' }, authorized as any)

      expect(authorized).toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(user).toEqual({ sub: '42' })
    })

    it('falls back to the global fetch', async () => {
      fetchMock.mockResolvedValue(respond(200, { sub: '42' }))

      expect(await defaultOAuthFunctions.userInfo({ userPath: '/userinfo' })).toEqual({ sub: '42' })
      expect(sent().url).toBe('/userinfo')
    })

    it('is undefined without a userPath', async () => {
      expect(await defaultOAuthFunctions.userInfo({})).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('introspect', () => {
    it('posts the token with basic auth', async () => {
      fetchMock.mockResolvedValue(respond(200, { active: true }))

      const info = await defaultOAuthFunctions.introspect(
        { access_token: 'at' },
        { introspectionPath: '/introspect', clientId: 'c', clientSecret: 's' }
      )

      expect(sent().headers.authorization).toBe(`Basic ${btoa('c:s')}`)
      expect(sent().body).toEqual({ token: 'at' })
      expect(info).toMatchObject({ active: true })
    })

    it('is undefined without a token', async () => {
      expect(await defaultOAuthFunctions.introspect({}, { introspectionPath: '/introspect', clientId: 'c' })).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
