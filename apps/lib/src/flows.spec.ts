import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { createOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

import { OAuthType } from './core/types'
import type { OAuth } from './types'

const mockLocation = {
  replace: jest.fn(),
  hash: '',
  search: ''
}
;(globalThis as any).location = mockLocation
// oauthCallback no-ops without a window (server render must not burn the code) — bun has none
;(globalThis as any).window = globalThis

describe('flows', () => {
  let oauth: OAuth
  let functions: {
    resourceOwnerLogin: jest.Mock
    clientCredentialLogin: jest.Mock
    openIdConfiguration: jest.Mock
    revoke: jest.Mock
    authorize: jest.Mock
  }

  beforeEach(() => {
    globalThis.localStorage?.clear()
    jest.clearAllMocks()
    mockLocation.hash = ''
    mockLocation.search = ''
    functions = {
      resourceOwnerLogin: jest.fn(),
      clientCredentialLogin: jest.fn(),
      openIdConfiguration: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn(),
      authorize: jest.fn()
    }
    oauth = createOAuth({ functions })
  })

  describe('login', () => {
    it('should perform client credential login if no parameters provided', async () => {
      const mockToken = { access_token: 'cc-token' }
      functions.clientCredentialLogin.mockResolvedValue(mockToken)

      await oauth.login()

      expect(functions.clientCredentialLogin).toHaveBeenCalled()
      expect(oauth.token.value).toEqual(mockToken)
    })

    it('should perform resource owner login if password is provided', async () => {
      const params = { username: 'user', password: 'pass' }
      const mockToken = { access_token: 'ro-token' }
      functions.resourceOwnerLogin.mockResolvedValue(mockToken)

      await oauth.login(params)

      expect(functions.resourceOwnerLogin).toHaveBeenCalledWith(params, oauth.typeConfig.value)
      expect(oauth.token.value).toEqual(mockToken)
    })

    it('should redirect to authorization URL for authorization code flow', async () => {
      oauth.typeConfig.value = {
        authorizePath: 'https://auth.com/authorize',
        clientId: 'client123',
        scope: 'openid profile'
      }
      const params = {
        redirectUri: 'https://app.com/callback',
        responseType: 'code',
        state: 'random-state'
      }

      const url = await oauth.login(params)

      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('https://auth.com/authorize?client_id=client123'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('redirect_uri=https%3A%2F%2Fapp.com%2Fcallback'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('response_type=code'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('state=random-state'))
      // the url is also returned so an SSR host (no location) can answer with a 302
      expect(url).toBe((mockLocation.replace as any).mock.calls.at(-1)[0])
      // redirect_uri, state, nonce and code_verifier land in one token write
      expect(oauth.token.value.redirect_uri).toBe('https://app.com/callback')
      expect(oauth.token.value.state).toBe('random-state')
      expect(oauth.token.value.nonce).toBeDefined()
    })

    it('generates a state when the caller supplies none, so the callback has something to check', async () => {
      oauth.typeConfig.value = { authorizePath: 'https://auth.com/authorize', clientId: 'client123', scope: 'openid' }

      await oauth.login({ redirectUri: 'https://app.com/callback', responseType: 'code' })

      const url: string = (mockLocation.replace as any).mock.calls.at(-1)[0]
      expect(oauth.token.value.state).toBeTruthy()
      expect(new URL(url).searchParams.get('state')).toBe(oauth.token.value.state as string)
    })

    it('should handle PKCE if enabled', async () => {
      oauth.typeConfig.value = {
        authorizePath: 'https://auth.com/authorize',
        clientId: 'client123',
        pkce: true,
        scope: 'openid'
      }
      const params = {
        redirectUri: 'https://app.com/callback',
        responseType: 'code'
      }

      await oauth.login(params)

      expect(oauth.token.value.code_verifier).toBeDefined()
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('code_challenge='))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('code_challenge_method=S256'))
    })
  })

  describe('logout', () => {
    it('should revoke token if no redirect URI provided', async () => {
      const initialToken = { access_token: 'token-to-revoke' }
      oauth.token.value = initialToken
      await oauth.logout()

      expect(functions.revoke).toHaveBeenCalledWith(initialToken, oauth.typeConfig.value)
      expect(oauth.token.value).toEqual({})
    })

    it('should redirect to logout path if provided with redirect URI', async () => {
      oauth.typeConfig.value = {
        logoutPath: 'https://auth.com/logout',
        clientId: 'client123'
      }
      oauth.token.value = { id_token: 'id-token-hint' }

      await oauth.logout('https://app.com/home', 'logout-state')

      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('https://auth.com/logout?'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('client_id=client123'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('post_logout_redirect_uri=https%3A%2F%2Fapp.com%2Fhome'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('id_token_hint=id-token-hint'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('state=logout-state'))
      expect(oauth.token.value).toEqual({})
    })

    it('should keep a redirect URI with its own query intact (encoded)', async () => {
      oauth.typeConfig.value = {
        logoutPath: 'https://auth.com/logout',
        clientId: 'client123'
      }

      await oauth.logout('https://app.com/cb?returnUrl=/checkout&lang=de')

      const url: string = (mockLocation.replace as any).mock.calls.at(-1)[0]
      // the redirect uri's own &/= must not leak into the logout url as separate params
      expect(new URL(url).searchParams.get('post_logout_redirect_uri')).toBe('https://app.com/cb?returnUrl=/checkout&lang=de')
      expect(new URL(url).searchParams.get('lang')).toBeNull()
    })
  })

  describe('oauthCallback', () => {
    it('should handle implicit flow redirect (hash)', async () => {
      mockLocation.hash = '#access_token=at&token_type=Bearer&state=s123'

      await oauth.oauthCallback()

      expect(oauth.token.value).toMatchObject({
        access_token: 'at',
        token_type: 'Bearer',
        type: OAuthType.IMPLICIT
      })
      expect(oauth.state.value).toBe('s123')
    })

    it('does not exchange on the server — a burned code would fail the client retry', async () => {
      const win = (globalThis as any).window
      delete (globalThis as any).window
      try {
        await oauth.oauthCallback('app:/oauth_callback?code=c123&state=s456')
        expect(functions.authorize).not.toHaveBeenCalled()
      } finally {
        ;(globalThis as any).window = win
      }
    })

    it('should handle authorization code redirect (search)', async () => {
      mockLocation.search = '?code=c123&state=s456'
      functions.authorize.mockResolvedValue({ access_token: 'new-at' })

      await oauth.oauthCallback()

      expect(oauth.token.value).toMatchObject({
        access_token: 'new-at'
      })
      expect(oauth.state.value).toBe('s456')
    })

    it('refuses a callback whose state is not the one the request was started with', async () => {
      oauth.typeConfig.value = { authorizePath: 'https://auth.com/authorize', clientId: 'client123', scope: 'openid' }
      await oauth.login({ redirectUri: 'https://app.com/callback', responseType: 'code' })
      mockLocation.search = '?code=c123&state=forged'

      await oauth.oauthCallback()

      expect(oauth.token.value.error).toBe('Invalid state')
      expect(functions.authorize).not.toHaveBeenCalled()
    })

    it('completes a callback carrying the state it issued', async () => {
      oauth.typeConfig.value = { authorizePath: 'https://auth.com/authorize', clientId: 'client123', scope: 'openid' }
      await oauth.login({ redirectUri: 'https://app.com/callback', responseType: 'code' })
      const { state, nonce } = oauth.token.value
      functions.authorize.mockResolvedValue({ access_token: 'new-at', id_token: `header.${btoa(JSON.stringify({ nonce }))}.sig` })
      mockLocation.search = `?code=c123&state=${state}`

      await oauth.oauthCallback()

      expect(oauth.token.value).toMatchObject({ access_token: 'new-at' })
    })

    it('should validate nonce if openid scope was used', async () => {
      // Use a real JWT with encoded nonce payload
      const jwtPayload = btoa(JSON.stringify({ nonce: 'n123' }))
      mockLocation.hash = `#access_token=at&id_token=header.${jwtPayload}.sig&nonce=n123`
      oauth.token.value = { nonce: 'mismatch' }

      await oauth.oauthCallback()

      expect(oauth.token.value.error).toBe('Invalid nonce')
    })

    it('should accept id_token without signature verification when strictJwt is false', async () => {
      const jwtPayload = btoa(JSON.stringify({ nonce: 'n123' }))
      mockLocation.hash = `#access_token=at&id_token=header.${jwtPayload}.sig`
      oauth.token.value = { nonce: 'n123' }

      await oauth.oauthCallback()

      expect(oauth.token.value.error).toBeUndefined()
      expect(oauth.token.value.access_token).toBe('at')
      expect(oauth.token.value.type).toBe(OAuthType.IMPLICIT)
    })
  })

  describe('autoconfigOauth', () => {
    it('should update config from well-known endpoint', async () => {
      const wellKnown = {
        authorization_endpoint: 'https://auth.com/a',
        token_endpoint: 'https://auth.com/t',
        revocation_endpoint: 'https://auth.com/r',
        userinfo_endpoint: 'https://auth.com/u',
        code_challenge_methods_supported: ['S256'],
        end_session_endpoint: 'https://auth.com/logout'
      }
      functions.openIdConfiguration.mockResolvedValue(wellKnown)

      await oauth.login()

      expect(oauth.typeConfig.value).toMatchObject({
        authorizePath: 'https://auth.com/a',
        tokenPath: 'https://auth.com/t',
        revokePath: 'https://auth.com/r',
        userPath: 'https://auth.com/u',
        logoutPath: 'https://auth.com/logout',
        pkce: true
      })
    })
  })
})
