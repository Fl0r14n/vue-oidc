import { beforeEach, describe, expect, it, jest, mock } from 'bun:test'
import { ref } from 'vue'

mock.module('./config', () => ({
  config: ref({})
}))

mock.module('./token', () => ({
  token: ref({})
}))

mock.module('./functions', () => ({
  oauthFunctions: {
    resourceOwnerLogin: jest.fn(),
    clientCredentialLogin: jest.fn(),
    openIdConfiguration: jest.fn(),
    revoke: jest.fn(),
    authorize: jest.fn()
  }
}))

;(globalThis as any).crypto = {
  getRandomValues: jest.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
    return arr
  }),
  subtle: {
    digest: jest.fn(async () => new Uint8Array(32).buffer)
  }
}

const mockLocation = {
  replace: jest.fn(),
  hash: '',
  search: ''
}
;(globalThis as any).location = mockLocation

import { config } from './config'
import { oauthFunctions } from './functions'
import { OAuthType } from './models'
import { login, logout, oauthCallback, state } from './oauth'
import { token } from './token'

describe('oauth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    token.value = {}
    config.value = {}
    state.value = undefined
    mockLocation.hash = ''
    mockLocation.search = ''
    ;(oauthFunctions.openIdConfiguration as any).mockResolvedValue(undefined)
  })

  describe('login', () => {
    it('should perform client credential login if no parameters provided', async () => {
      const mockToken = { access_token: 'cc-token' }
      ;(oauthFunctions.clientCredentialLogin as any).mockResolvedValue(mockToken)

      await login()

      expect(oauthFunctions.clientCredentialLogin).toHaveBeenCalled()
      expect(token.value).toEqual(mockToken)
    })

    it('should perform resource owner login if password is provided', async () => {
      const params = { username: 'user', password: 'pass' }
      const mockToken = { access_token: 'ro-token' }
      ;(oauthFunctions.resourceOwnerLogin as any).mockResolvedValue(mockToken)

      await login(params)

      expect(oauthFunctions.resourceOwnerLogin).toHaveBeenCalledWith(params, config.value)
      expect(token.value).toEqual(mockToken)
    })

    it('should redirect to authorization URL for authorization code flow', async () => {
      config.value = {
        authorizePath: 'https://auth.com/authorize',
        clientId: 'client123',
        scope: 'openid profile'
      }
      const params = {
        redirectUri: 'https://app.com/callback',
        responseType: 'code',
        state: 'random-state'
      }

      await login(params)

      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('https://auth.com/authorize?client_id=client123'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('redirect_uri=https%3A%2F%2Fapp.com%2Fcallback'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('response_type=code'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('state=random-state'))
    })

    it('should handle PKCE if enabled', async () => {
      config.value = {
        authorizePath: 'https://auth.com/authorize',
        clientId: 'client123',
        pkce: true,
        scope: 'openid'
      }
      const params = {
        redirectUri: 'https://app.com/callback',
        responseType: 'code'
      }

      await login(params)

      expect(token.value.code_verifier).toBeDefined()
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('code_challenge='))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('code_challenge_method=S256'))
    })
  })

  describe('logout', () => {
    it('should revoke token if no redirect URI provided', async () => {
      const initialToken = { access_token: 'token-to-revoke' }
      token.value = initialToken
      await logout()

      expect(oauthFunctions.revoke).toHaveBeenCalledWith(initialToken, config.value)
      expect(token.value).toEqual({})
    })

    it('should redirect to logout path if provided with redirect URI', async () => {
      config.value = {
        logoutPath: 'https://auth.com/logout',
        clientId: 'client123'
      }
      token.value = { id_token: 'id-token-hint' }

      await logout('https://app.com/home', 'logout-state')

      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('https://auth.com/logout?client_id=client123'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('post_logout_redirect_uri=https://app.com/home'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('id_token_hint=id-token-hint'))
      expect(mockLocation.replace).toHaveBeenCalledWith(expect.stringContaining('state=logout-state'))
      expect(token.value).toEqual({})
    })
  })

  describe('oauthCallback', () => {
    it('should handle implicit flow redirect (hash)', async () => {
      mockLocation.hash = '#access_token=at&token_type=Bearer&state=s123'

      await oauthCallback()

      expect(token.value).toMatchObject({
        access_token: 'at',
        token_type: 'Bearer',
        type: OAuthType.IMPLICIT
      })
      expect(state.value).toBe('s123')
    })

    it('should handle authorization code redirect (search)', async () => {
      mockLocation.search = '?code=c123&state=s456'
      ;(oauthFunctions.authorize as any).mockResolvedValue({ access_token: 'new-at' })

      await oauthCallback()

      expect(token.value).toMatchObject({
        access_token: 'new-at'
      })
      expect(state.value).toBe('s456')
    })

    it('should validate nonce if openid scope was used', async () => {
      // Use a real JWT with encoded nonce payload
      const jwtPayload = btoa(JSON.stringify({ nonce: 'n123' }))
      mockLocation.hash = `#access_token=at&id_token=header.${jwtPayload}.sig&nonce=n123`
      token.value = { nonce: 'mismatch' }

      await oauthCallback()

      expect(token.value.error).toBe('Invalid nonce')
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
      ;(oauthFunctions.openIdConfiguration as any).mockResolvedValue(wellKnown)

      await login()

      expect(config.value).toMatchObject({
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
