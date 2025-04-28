// lib/src/config.spec.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { config, ignoredPaths, oauthConfig, storageKey } from './config'
import type { OAuthTypeConfig } from './models' // Assuming models.ts is in the same dir

describe('config.ts', () => {
  // Reset config before each test
  beforeEach(() => {
    oauthConfig.value = {
      storageKey: 'token',
      ignorePaths: [],
      config: undefined // Reset config part
    }
  })

  it('should have default storageKey', () => {
    expect(storageKey.value).toBe('token')
  })

  it('should update storageKey', () => {
    storageKey.value = 'newTokenKey'
    expect(oauthConfig.value.storageKey).toBe('newTokenKey')
    expect(storageKey.value).toBe('newTokenKey')
  })

  it('should handle null/undefined storageKey update by defaulting to "token"', () => {
    // Set explicitly to something else first
    storageKey.value = 'customKey'
    expect(storageKey.value).toBe('customKey')
    // Set to undefined or null (which might happen via external config)
    oauthConfig.value.storageKey = undefined
    expect(storageKey.value).toBe('token') // Should fall back to default
  })

  it('should have default ignoredPaths as empty array', () => {
    expect(ignoredPaths.value).toEqual([])
  })

  it('should reflect updated ignoredPaths', () => {
    const newPaths = ['/login', '/public']
    oauthConfig.value.ignorePaths = newPaths
    expect(ignoredPaths.value).toEqual(newPaths)
  })

  it('should have undefined initial config', () => {
    expect(config.value).toBeUndefined()
  })

  it('should update config', () => {
    const newConfig: OAuthTypeConfig = {
      authUrl: 'https://example.com/auth',
      clientId: 'test-client',
      scope: 'openid profile email',
      tokenUrl: 'https://example.com/token', // Added missing required property
      redirectUrl: window.location.origin // Added missing required property
    }
    config.value = newConfig
    expect(oauthConfig.value.config).toEqual(newConfig)
    expect(config.value).toEqual(newConfig)
  })

  it('should merge partial config updates', () => {
    const initialConfig: OAuthTypeConfig = {
      authUrl: 'https://initial.com/auth',
      clientId: 'initial-client',
      scope: 'openid',
      tokenUrl: 'https://initial.com/token',
      redirectUrl: window.location.origin
    }
    config.value = initialConfig // Set initial config

    const partialUpdate = {
      clientId: 'updated-client',
      scope: 'openid profile' // Update scope
    }
    config.value = partialUpdate // Apply partial update

    const expectedConfig: OAuthTypeConfig = {
      ...initialConfig,
      ...partialUpdate
    }

    expect(oauthConfig.value.config).toEqual(expectedConfig)
    expect(config.value).toEqual(expectedConfig)
  })
})
