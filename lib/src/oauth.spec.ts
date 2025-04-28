import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import * as oauthModule from './oauth'

vi.mock('@/config', () => ({ config: ref({}) }))
vi.mock('@/functions', () => ({
  oauthFunctions: {
    resourceOwnerLogin: vi.fn(),
    clientCredentialLogin: vi.fn(),
    openIdConfiguration: vi.fn(),
    authorize: vi.fn(),
    revoke: vi.fn()
  }
}))
vi.mock('@/token', () => ({ token: ref({}) }))
vi.mock('@/user', () => ({ jwt: vi.fn(() => ({})) }))

describe('oauth.ts', () => {
  let originalLocation: Location

  beforeEach(() => {
    originalLocation = globalThis.location
    // @ts-ignore
    globalThis.location = { replace: vi.fn() }
    oauthModule.token.value = {}
    oauthModule.state.value = undefined
  })

  afterEach(() => {
    // @ts-ignore
    globalThis.location = originalLocation
    vi.clearAllMocks()
  })

  describe('parseOauthUri', () => {
    it('parses hash params correctly', () => {
      const hash = 'access_token=abc&state=xyz'
      expect(oauthModule['parseOauthUri'](hash)).toEqual({ access_token: 'abc', state: 'xyz' })
    })
  })

  describe('login', () => {
    it('calls resourceOwnerLogin for password grant', async () => {
      const { oauthFunctions } = require('@/functions')
      oauthFunctions.resourceOwnerLogin.mockResolvedValue({ access_token: 'abc' })
      await oauthModule.login({ password: 'pw', username: 'user' })
      expect(oauthFunctions.resourceOwnerLogin).toHaveBeenCalled()
      expect(oauthModule.token.value.access_token).toBe('abc')
    })
    it('calls clientCredentialLogin if no params', async () => {
      const { oauthFunctions } = require('@/functions')
      oauthFunctions.clientCredentialLogin.mockResolvedValue({ access_token: 'def' })
      await oauthModule.login()
      expect(oauthFunctions.clientCredentialLogin).toHaveBeenCalled()
      expect(oauthModule.token.value.access_token).toBe('def')
    })
    it('calls toAuthorizationUrl for authorization code', async () => {
      const spy = vi.spyOn(oauthModule, 'toAuthorizationUrl').mockResolvedValue(undefined)
      await oauthModule.login({ redirectUri: 'http://cb', responseType: 'code' })
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('logout', () => {
    it('calls location.replace with logout url if logoutRedirectUri and logoutPath', async () => {
      const { config } = require('@/config')
      config.value = { logoutPath: 'http://logout', clientId: 'cid' }
      oauthModule.token.value = { id_token: 'idtok' }
      await oauthModule.logout('http://cb')
      expect(globalThis.location.replace).toHaveBeenCalledWith(
        'http://logout?client_id=cid&post_logout_redirect_uri=http://cb&id_token_hint=idtok'
      )
      expect(oauthModule.token.value).toEqual({})
    })
    it('calls revoke if no logoutRedirectUri', async () => {
      const { oauthFunctions } = require('@/functions')
      oauthFunctions.revoke.mockResolvedValue(undefined)
      oauthModule.token.value = { access_token: 'tok' }
      await oauthModule.logout()
      expect(oauthFunctions.revoke).toHaveBeenCalled()
      expect(oauthModule.token.value).toEqual({})
    })
  })

  describe('oauthCallback', () => {
    it('handles implicit redirect', async () => {
      // @ts-ignore
      globalThis.location = { hash: '#access_token=abc&state=xyz', replace: vi.fn() }
      await oauthModule.oauthCallback()
      expect(oauthModule.token.value.type).toBe(oauthModule.OAuthType.IMPLICIT)
      expect(oauthModule.state.value).toBe('xyz')
    })
    it('handles authorization code redirect', async () => {
      // @ts-ignore
      globalThis.location = { search: '?code=abc&state=xyz', replace: vi.fn() }
      const { oauthFunctions } = require('@/functions')
      oauthFunctions.openIdConfiguration.mockResolvedValue({})
      oauthFunctions.authorize.mockResolvedValue({ id_token: 'idtok', state: 'xyz' })
      await oauthModule.oauthCallback()
      expect(oauthModule.token.value.type).toBe(oauthModule.OAuthType.AUTHORIZATION_CODE)
      expect(oauthModule.state.value).toBe('xyz')
    })
  })
})
