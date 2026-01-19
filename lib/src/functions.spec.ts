import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { oauthFunctions } from './functions'
import { OAuthType, type ClientCredentialConfig, type OpenIdConfig } from './models'

vi.mock('axios')

describe('functions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('refresh', () => {
    it('should return original token if refresh_token or tokenPath is missing', async () => {
      const token = { access_token: 'at' }
      const result = await oauthFunctions.refresh(token, {} as OpenIdConfig)
      expect(result).toBe(token)
    })

    it('should call axios.post with correct parameters and return new token', async () => {
      const token = { refresh_token: 'rt', type: OAuthType.AUTHORIZATION_CODE }
      const config = {
        tokenPath: '/token',
        clientId: 'cid',
        clientSecret: 'cs',
        scope: 's',
        issuerPath: 'i',
        authorizePath: 'a'
      } as OpenIdConfig
      const mockResponse = { data: { access_token: 'new-at' } }
      vi.mocked(axios.post).mockResolvedValue(mockResponse)

      const result = await oauthFunctions.refresh(token, config)

      expect(axios.post).toHaveBeenCalledWith(
        '/token',
        {
          client_id: 'cid',
          client_secret: 'cs',
          grant_type: 'refresh_token',
          refresh_token: 'rt',
          scope: 's'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
          }
        }
      )
      expect(result).toEqual({ access_token: 'new-at', type: OAuthType.AUTHORIZATION_CODE })
    })
  })

  describe('revoke', () => {
    it('should not call axios if revokePath is missing', async () => {
      await oauthFunctions.revoke({ access_token: 'at' }, {} as OpenIdConfig)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should revoke access_token and refresh_token if present', async () => {
      const token = { access_token: 'at', refresh_token: 'rt' }
      const config = { revokePath: '/revoke', clientId: 'cid', tokenPath: '/t' } as OpenIdConfig
      vi.mocked(axios.post).mockResolvedValue({ data: {} })

      await oauthFunctions.revoke(token, config)

      expect(axios.post).toHaveBeenCalledTimes(2)
      expect(axios.post).toHaveBeenCalledWith(
        '/revoke',
        expect.objectContaining({ token: 'at', token_type_hint: 'access_token' }),
        expect.anything()
      )
      expect(axios.post).toHaveBeenCalledWith(
        '/revoke',
        expect.objectContaining({ token: 'rt', token_type_hint: 'refresh_token' }),
        expect.anything()
      )
    })
  })

  describe('authorize', () => {
    it('should return original token if code or tokenPath is missing', async () => {
      const token = { code: 'c' }
      const result = await oauthFunctions.authorize(token, {} as OpenIdConfig)
      expect(result).toBe(token)
    })

    it('should exchange code for token', async () => {
      const token = { code: 'c', redirect_uri: 'uri', code_verifier: 'cv' }
      const config = { tokenPath: '/token', clientId: 'cid', authorizePath: 'a' } as OpenIdConfig
      vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'at' } })

      const result = await oauthFunctions.authorize(token, config)

      expect(axios.post).toHaveBeenCalledWith(
        '/token',
        expect.objectContaining({
          code: 'c',
          grant_type: 'authorization_code',
          code_verifier: 'cv'
        }),
        expect.anything()
      )
      expect(result).toEqual({ access_token: 'at', type: OAuthType.AUTHORIZATION_CODE })
    })
  })

  describe('clientCredentialLogin', () => {
    it('should return undefined if tokenPath is missing', async () => {
      const result = await oauthFunctions.clientCredentialLogin({} as ClientCredentialConfig)
      expect(result).toBeUndefined()
    })

    it('should perform client credentials login', async () => {
      const config = { tokenPath: '/token', clientId: 'cid', clientSecret: 'cs' } as ClientCredentialConfig
      vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'at' } })

      const result = await oauthFunctions.clientCredentialLogin(config)

      expect(axios.post).toHaveBeenCalledWith(
        '/token',
        {
          client_id: 'cid',
          client_secret: 'cs',
          grant_type: OAuthType.CLIENT_CREDENTIAL
        },
        expect.anything()
      )
      expect(result).toEqual({ access_token: 'at', type: OAuthType.CLIENT_CREDENTIAL })
    })
  })

  describe('resourceOwnerLogin', () => {
    it('should return undefined if tokenPath or clientId is missing', async () => {
      const result = await oauthFunctions.resourceOwnerLogin({ username: 'u', password: 'p' }, {
        tokenPath: '/token'
      } as ClientCredentialConfig)
      expect(result).toBeUndefined()
    })

    it('should perform resource owner password login', async () => {
      const params = { username: 'u', password: 'p' }
      const config = { tokenPath: '/token', clientId: 'cid' } as ClientCredentialConfig
      vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'at' } })

      const result = await oauthFunctions.resourceOwnerLogin(params, config)

      expect(axios.post).toHaveBeenCalledWith(
        '/token',
        expect.objectContaining({
          username: 'u',
          password: 'p',
          grant_type: OAuthType.RESOURCE
        }),
        expect.anything()
      )
      expect(result).toEqual({ access_token: 'at', type: OAuthType.RESOURCE })
    })
  })

  describe('openIdConfiguration', () => {
    it('should return undefined if issuerPath is missing', async () => {
      const result = await oauthFunctions.openIdConfiguration({} as OpenIdConfig)
      expect(result).toBeUndefined()
    })

    it('should fetch openid configuration', async () => {
      const config = {
        issuerPath: 'https://issuer',
        clientId: 'cid',
        tokenPath: 't',
        authorizePath: 'a'
      } as OpenIdConfig
      vi.mocked(axios.get).mockResolvedValue({ data: { issuer: 'https://issuer' } })

      const result = await oauthFunctions.openIdConfiguration(config)

      expect(axios.get).toHaveBeenCalledWith('https://issuer/.well-known/openid-configuration?client_id=cid')
      expect(result).toEqual({ issuer: 'https://issuer' })
    })
  })

  describe('userInfo', () => {
    it('should return undefined if userPath is missing', async () => {
      const result = await oauthFunctions.userInfo({} as OpenIdConfig)
      expect(result).toBeUndefined()
    })

    it('should fetch user info using default axios', async () => {
      const config = { userPath: '/user', tokenPath: 't', clientId: 'c' } as OpenIdConfig
      vi.mocked(axios.get).mockResolvedValue({ data: { sub: '123' } })

      const result = await oauthFunctions.userInfo(config)

      expect(axios.get).toHaveBeenCalledWith('/user')
      expect(result).toEqual({ sub: '123' })
    })

    it('should fetch user info using provided http instance', async () => {
      const config = { userPath: '/user', tokenPath: 't', clientId: 'c' } as OpenIdConfig
      const mockHttp = { get: vi.fn().mockResolvedValue({ data: { sub: '456' } }) } as any

      const result = await oauthFunctions.userInfo(config, mockHttp)

      expect(mockHttp.get).toHaveBeenCalledWith('/user')
      expect(result).toEqual({ sub: '456' })
    })
  })

  describe('introspect', () => {
    it('should return undefined if parameters are missing', async () => {
      const result = await oauthFunctions.introspect({}, {} as OpenIdConfig)
      expect(result).toBeUndefined()
    })

    it('should perform token introspection with basic auth', async () => {
      const token = { access_token: 'at' }
      const config = {
        introspectionPath: '/introspect',
        clientId: 'cid',
        clientSecret: 'cs',
        tokenPath: 't'
      } as OpenIdConfig
      vi.mocked(axios.post).mockResolvedValue({ data: { active: true } })

      const result = await oauthFunctions.introspect(token, config)

      expect(axios.post).toHaveBeenCalledWith(
        '/introspect',
        { token: 'at' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Basic ' + btoa('cid:cs')
          })
        })
      )
      expect(result).toEqual({ active: true })
    })
  })
})
