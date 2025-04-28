// lib/src/functions.spec.ts
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { oauthFunctions } from './functions'
import type { OAuthTypeConfig, Token } from './models'
import { OAuthType } from './models'

// Mock axios
vi.mock('axios')

// Helper to create a mock config
const createMockConfig = (overrides: Partial<OAuthTypeConfig> = {}): OAuthTypeConfig => ({
  tokenPath: 'https://example.com/token',
  revokePath: 'https://example.com/revoke',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  scope: 'openid profile',
  authUrl: 'https://example.com/auth', // Added required properties
  redirectUrl: 'http://localhost:3000', // Added required properties
  ...overrides
})

// Helper to create a mock token
const createMockToken = (overrides: Partial<Token> = {}): Token => ({
  access_token: 'access123',
  refresh_token: 'refresh456',
  expires_in: 3600,
  token_type: 'Bearer',
  type: OAuthType.AUTHORIZATION_CODE, // Example type
  ...overrides
})

describe('oauthFunctions', () => {
  let mockConfig: OAuthTypeConfig
  let mockToken: Token

  beforeEach(() => {
    mockConfig = createMockConfig()
    mockToken = createMockToken()
    // Reset mocks before each test
    vi.resetAllMocks()
  })

  // --- Refresh Tests ---
  describe('refresh', () => {
    it('should call axios.post with correct parameters and return new token', async () => {
      const refreshedTokenData = { access_token: 'newAccess', expires_in: 7200 }
      const expectedNewToken = { ...refreshedTokenData, type: mockToken.type }
      vi.mocked(axios.post).mockResolvedValue({ data: refreshedTokenData })

      const result = await oauthFunctions.refresh(mockToken, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.tokenPath,
        {
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: mockToken.refresh_token,
          scope: mockConfig.scope
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      expect(result).toEqual(expectedNewToken)
    })

    it('should return original token if refresh_token is missing', async () => {
      const tokenWithoutRefresh = { ...mockToken, refresh_token: undefined }
      const result = await oauthFunctions.refresh(tokenWithoutRefresh, mockConfig)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toEqual(tokenWithoutRefresh)
    })

    it('should return original token if tokenPath is missing in config', async () => {
      const configWithoutPath = { ...mockConfig, tokenPath: undefined }
      const result = await oauthFunctions.refresh(mockToken, configWithoutPath)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toEqual(mockToken)
    })

    it('should return original token on axios error', async () => {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 500 } }) // Simulate server error
      const result = await oauthFunctions.refresh(mockToken, mockConfig)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockToken) // Should return original token on failure
    })

    it('should handle missing clientSecret and scope', async () => {
      const configMinimal = createMockConfig({ clientSecret: undefined, scope: undefined })
      const refreshedTokenData = { access_token: 'newAccessMinimal', expires_in: 3600 }
      vi.mocked(axios.post).mockResolvedValue({ data: refreshedTokenData })

      await oauthFunctions.refresh(mockToken, configMinimal)

      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.tokenPath,
        {
          client_id: configMinimal.clientId,
          // No client_secret
          grant_type: 'refresh_token',
          refresh_token: mockToken.refresh_token
          // No scope
        },
        expect.any(Object) // Headers
      )
    })
  })

  // --- Revoke Tests ---
  describe('revoke', () => {
    it('should call axios.post twice if both tokens and revokePath exist', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: {} }) // Mock successful revocation

      await oauthFunctions.revoke(mockToken, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(2)
      // Call 1: Revoke access token
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.revokePath,
        {
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          token: mockToken.access_token,
          token_type_hint: 'access_token'
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      // Call 2: Revoke refresh token
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.revokePath,
        {
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          token: mockToken.refresh_token,
          token_type_hint: 'refresh_token'
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
    })

    it('should call axios.post once if only access_token exists', async () => {
      const tokenOnlyAccess = { ...mockToken, refresh_token: undefined }
      vi.mocked(axios.post).mockResolvedValue({ data: {} })

      await oauthFunctions.revoke(tokenOnlyAccess, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.revokePath,
        expect.objectContaining({ token: tokenOnlyAccess.access_token, token_type_hint: 'access_token' }),
        expect.any(Object)
      )
    })

    it('should call axios.post once if only refresh_token exists', async () => {
      const tokenOnlyRefresh = { ...mockToken, access_token: undefined }
      vi.mocked(axios.post).mockResolvedValue({ data: {} })

      await oauthFunctions.revoke(tokenOnlyRefresh, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.revokePath,
        expect.objectContaining({ token: tokenOnlyRefresh.refresh_token, token_type_hint: 'refresh_token' }),
        expect.any(Object)
      )
    })

    it('should not call axios.post if revokePath is missing', async () => {
      const configWithoutPath = { ...mockConfig, revokePath: undefined }
      await oauthFunctions.revoke(mockToken, configWithoutPath)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should not call axios.post if token is missing', async () => {
      await oauthFunctions.revoke(undefined, mockConfig)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('should handle axios errors gracefully', async () => {
      vi.mocked(axios.post)
        .mockRejectedValueOnce({ response: { status: 500 } }) // Error on first call (access token)
        .mockResolvedValueOnce({ data: {} }) // Success on second call (refresh token)

      // Expect no error to be thrown from the function itself
      await expect(oauthFunctions.revoke(mockToken, mockConfig)).resolves.toBeUndefined()
      expect(axios.post).toHaveBeenCalledTimes(2) // Still attempts both
    })

    it('should handle missing clientId and clientSecret', async () => {
      const configMinimal = createMockConfig({ clientId: undefined, clientSecret: undefined })
      vi.mocked(axios.post).mockResolvedValue({ data: {} })

      await oauthFunctions.revoke(mockToken, configMinimal)

      expect(axios.post).toHaveBeenCalledTimes(2)
      // Check first call (access token) for missing client_id/client_secret
      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.revokePath,
        {
          // No client_id
          // No client_secret
          token: mockToken.access_token,
          token_type_hint: 'access_token'
        },
        expect.any(Object)
      )
      // Check second call (refresh token) for missing client_id/client_secret
      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.revokePath,
        {
          // No client_id
          // No client_secret
          token: mockToken.refresh_token,
          token_type_hint: 'refresh_token'
        },
        expect.any(Object)
      )
    })
  })

  // --- Authorize Tests ---
  describe('authorize', () => {
    const authCodeToken: Partial<Token> = {
      code: 'authCode123',
      redirect_uri: 'http://localhost:3000/callback',
      code_verifier: 'verifierXYZ'
    }

    it('should call axios.post with correct parameters and return new token', async () => {
      const authorizedTokenData = { access_token: 'authAccess', refresh_token: 'authRefresh', expires_in: 3600 }
      const expectedNewToken = { ...authorizedTokenData, type: OAuthType.AUTHORIZATION_CODE }
      vi.mocked(axios.post).mockResolvedValue({ data: authorizedTokenData })

      const result = await oauthFunctions.authorize(authCodeToken, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.tokenPath,
        {
          code: authCodeToken.code,
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          redirect_uri: authCodeToken.redirect_uri,
          grant_type: 'authorization_code',
          scope: mockConfig.scope,
          code_verifier: authCodeToken.code_verifier
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      expect(result).toEqual(expectedNewToken)
    })

    it('should return original token if code is missing', async () => {
      const tokenWithoutCode = { ...authCodeToken, code: undefined }
      const result = await oauthFunctions.authorize(tokenWithoutCode, mockConfig)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toEqual(tokenWithoutCode)
    })

    it('should return original token if tokenPath is missing', async () => {
      const configWithoutPath = { ...mockConfig, tokenPath: undefined }
      const result = await oauthFunctions.authorize(authCodeToken, configWithoutPath)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toEqual(authCodeToken)
    })

    it('should return original token on axios error', async () => {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 400 } })
      const result = await oauthFunctions.authorize(authCodeToken, mockConfig)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(result).toEqual(authCodeToken)
    })

    it('should handle missing clientSecret, scope, and code_verifier', async () => {
      const configMinimal = createMockConfig({ clientSecret: undefined, scope: undefined })
      const tokenMinimal = { ...authCodeToken, code_verifier: undefined }
      const authorizedTokenData = { access_token: 'authAccessMin', expires_in: 3600 }
      vi.mocked(axios.post).mockResolvedValue({ data: authorizedTokenData })

      await oauthFunctions.authorize(tokenMinimal, configMinimal)

      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.tokenPath,
        {
          code: tokenMinimal.code,
          client_id: configMinimal.clientId,
          // No client_secret
          redirect_uri: tokenMinimal.redirect_uri,
          grant_type: 'authorization_code'
          // No scope
          // No code_verifier
        },
        expect.any(Object)
      )
    })
  })

  // --- Client Credential Login Tests ---
  describe('clientCredentialLogin', () => {
    it('should call axios.post with correct parameters and return token', async () => {
      const ccTokenData = { access_token: 'ccAccess', expires_in: 1800 }
      const expectedToken = { ...ccTokenData, type: OAuthType.CLIENT_CREDENTIAL }
      vi.mocked(axios.post).mockResolvedValue({ data: ccTokenData })

      const result = await oauthFunctions.clientCredentialLogin(mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.tokenPath,
        {
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          grant_type: OAuthType.CLIENT_CREDENTIAL,
          scope: mockConfig.scope
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      expect(result).toEqual(expectedToken)
    })

    it('should return undefined if tokenPath is missing', async () => {
      const configWithoutPath = { ...mockConfig, tokenPath: undefined }
      const result = await oauthFunctions.clientCredentialLogin(configWithoutPath)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return undefined on axios error', async () => {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 401 } })
      const result = await oauthFunctions.clientCredentialLogin(mockConfig)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
    })

    it('should handle missing scope', async () => {
      const configMinimal = createMockConfig({ scope: undefined })
      const ccTokenData = { access_token: 'ccAccessMin', expires_in: 1800 }
      vi.mocked(axios.post).mockResolvedValue({ data: ccTokenData })

      await oauthFunctions.clientCredentialLogin(configMinimal)

      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.tokenPath,
        {
          client_id: configMinimal.clientId,
          client_secret: configMinimal.clientSecret,
          grant_type: OAuthType.CLIENT_CREDENTIAL
          // No scope
        },
        expect.any(Object)
      )
    })
  })

  // --- Resource Owner Login Tests ---
  describe('resourceOwnerLogin', () => {
    const loginParams = { username: 'user', password: 'password' }

    it('should call axios.post with correct parameters and return token', async () => {
      const roTokenData = { access_token: 'roAccess', refresh_token: 'roRefresh', expires_in: 3600 }
      const expectedToken = { ...roTokenData, type: OAuthType.RESOURCE }
      vi.mocked(axios.post).mockResolvedValue({ data: roTokenData })

      const result = await oauthFunctions.resourceOwnerLogin(loginParams, mockConfig)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.tokenPath,
        {
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          grant_type: OAuthType.RESOURCE,
          scope: mockConfig.scope,
          username: loginParams.username,
          password: loginParams.password
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      expect(result).toEqual(expectedToken)
    })

    it('should return undefined if tokenPath or clientId is missing', async () => {
      let configMissing = { ...mockConfig, tokenPath: undefined }
      let result = await oauthFunctions.resourceOwnerLogin(loginParams, configMissing)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()

      vi.resetAllMocks() // Reset for next check

      configMissing = { ...mockConfig, clientId: undefined }
      result = await oauthFunctions.resourceOwnerLogin(loginParams, configMissing)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return undefined on axios error', async () => {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 401 } })
      const result = await oauthFunctions.resourceOwnerLogin(loginParams, mockConfig)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
    })

    it('should handle missing clientSecret and scope', async () => {
      const configMinimal = createMockConfig({ clientSecret: undefined, scope: undefined })
      const roTokenData = { access_token: 'roAccessMin', expires_in: 3600 }
      vi.mocked(axios.post).mockResolvedValue({ data: roTokenData })

      await oauthFunctions.resourceOwnerLogin(loginParams, configMinimal)

      expect(axios.post).toHaveBeenCalledWith(
        configMinimal.tokenPath,
        {
          client_id: configMinimal.clientId,
          // No client_secret
          grant_type: OAuthType.RESOURCE,
          // No scope
          username: loginParams.username,
          password: loginParams.password
        },
        expect.any(Object)
      )
    })
  })

  // --- OpenID Configuration Tests ---
  describe('openIdConfiguration', () => {
    const mockOidcConfig = { issuer: 'https://example.com', authorization_endpoint: 'https://example.com/auth' }
    const configWithIssuer = createMockConfig({ issuerPath: 'https://example.com/issuer' })

    it('should call axios.get with correct URL and return config', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockOidcConfig })

      const result = await oauthFunctions.openIdConfiguration(configWithIssuer)

      expect(axios.get).toHaveBeenCalledTimes(1)
      expect(axios.get).toHaveBeenCalledWith(
        `${configWithIssuer.issuerPath}/.well-known/openid-configuration?client_id=${configWithIssuer.clientId}`
      )
      expect(result).toEqual(mockOidcConfig)
    })

    it('should return undefined if issuerPath is missing', async () => {
      const configWithoutIssuer = { ...configWithIssuer, issuerPath: undefined }
      const result = await oauthFunctions.openIdConfiguration(configWithoutIssuer)
      expect(axios.get).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return undefined on axios error', async () => {
      vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } })
      const result = await oauthFunctions.openIdConfiguration(configWithIssuer)
      expect(axios.get).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
    })
  })

  // --- User Info Tests ---
  describe('userInfo', () => {
    const mockUserInfo = { sub: '12345', name: 'Test User' }
    const configWithUserPath = createMockConfig({ userPath: 'https://example.com/userinfo' })

    it('should call axios.get with correct URL and return user info', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: mockUserInfo })

      const result = await oauthFunctions.userInfo(configWithUserPath)

      expect(axios.get).toHaveBeenCalledTimes(1)
      expect(axios.get).toHaveBeenCalledWith(configWithUserPath.userPath)
      expect(result).toEqual(mockUserInfo)
    })

    it('should use provided http client if available', async () => {
      const mockHttpClient = { get: vi.fn().mockResolvedValue({ data: mockUserInfo }) }
      vi.mocked(axios.get).mockResolvedValue({ data: { should: 'not be called' } }) // Ensure default axios isn't called

      const result = await oauthFunctions.userInfo(configWithUserPath, mockHttpClient as any) // Cast for testing

      expect(mockHttpClient.get).toHaveBeenCalledTimes(1)
      expect(mockHttpClient.get).toHaveBeenCalledWith(configWithUserPath.userPath)
      expect(axios.get).not.toHaveBeenCalled()
      expect(result).toEqual(mockUserInfo)
    })

    it('should return undefined if userPath is missing', async () => {
      const configWithoutUserPath = { ...configWithUserPath, userPath: undefined }
      const result = await oauthFunctions.userInfo(configWithoutUserPath)
      expect(axios.get).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return undefined on axios error', async () => {
      vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } })
      const result = await oauthFunctions.userInfo(configWithUserPath)
      expect(axios.get).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
    })
  })

  // --- Introspect Tests ---
  describe('introspect', () => {
    const mockIntrospectionResult = { active: true, sub: 'user123' }
    const configWithIntrospection = createMockConfig({ introspectionPath: 'https://example.com/introspect' })

    it('should call axios.post with correct parameters and return introspection result', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: mockIntrospectionResult })
      // Mock btoa as it might not be available in all test environments
      global.btoa = vi.fn(str => Buffer.from(str).toString('base64'))

      const result = await oauthFunctions.introspect(mockToken, configWithIntrospection)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        configWithIntrospection.introspectionPath,
        { token: mockToken.access_token },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Authorization: `Basic ${btoa(`${configWithIntrospection.clientId}:${configWithIntrospection.clientSecret}`)}`
          }
        }
      )
      expect(result).toEqual(mockIntrospectionResult)
      vi.restoreAllMocks() // Restore btoa mock
    })

    it('should return undefined if introspectionPath, access_token, or clientId is missing', async () => {
      let result = await oauthFunctions.introspect(mockToken, { ...configWithIntrospection, introspectionPath: undefined })
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()

      vi.resetAllMocks()
      result = await oauthFunctions.introspect({ ...mockToken, access_token: undefined }, configWithIntrospection)
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()

      vi.resetAllMocks()
      result = await oauthFunctions.introspect(mockToken, { ...configWithIntrospection, clientId: undefined })
      expect(axios.post).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return undefined on axios error', async () => {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 500 } })
      global.btoa = vi.fn(str => Buffer.from(str).toString('base64')) // Mock btoa

      const result = await oauthFunctions.introspect(mockToken, configWithIntrospection)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
      vi.restoreAllMocks() // Restore btoa mock
    })
  })
})
