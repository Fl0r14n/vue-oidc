import { beforeEach, describe, expect, it } from 'vitest'
import { config, ignoredPaths, oauthConfig, storageKey } from './config'
import type { OAuthTypeConfig } from './models'

describe('config', () => {
  beforeEach(() => {
    // Reset oauthConfig to its initial state before each test
    oauthConfig.value = {
      storageKey: 'token',
      ignorePaths: []
    }
  })

  describe('oauthConfig', () => {
    it('should have default values', () => {
      expect(oauthConfig.value.storageKey).toBe('token')
      expect(oauthConfig.value.ignorePaths).toEqual([])
    })
  })

  describe('config', () => {
    it('should return undefined if no config is set', () => {
      expect(config.value).toBeUndefined()
    })

    it('should update oauthConfig.value.config when set', () => {
      const newConfig: Partial<OAuthTypeConfig> = {
        clientId: 'test-client'
      }
      config.value = newConfig as OAuthTypeConfig
      expect(oauthConfig.value.config).toEqual(newConfig)
    })

    it('should merge existing config when set', () => {
      oauthConfig.value.config = {
        clientId: 'old-client',
        scope: 'read'
      } as OAuthTypeConfig

      const newConfig: Partial<OAuthTypeConfig> = {
        clientId: 'new-client'
      }
      config.value = newConfig as OAuthTypeConfig

      expect(oauthConfig.value.config).toEqual({
        clientId: 'new-client',
        scope: 'read'
      })
    })
  })

  describe('ignoredPaths', () => {
    it('should return ignorePaths from oauthConfig', () => {
      const regex = [/^\/api\/.*/]
      oauthConfig.value.ignorePaths = regex
      expect(ignoredPaths.value).toEqual(regex)
    })
  })

  describe('storageKey', () => {
    it('should return the storageKey from oauthConfig', () => {
      oauthConfig.value.storageKey = 'custom-token'
      expect(storageKey.value).toBe('custom-token')
    })

    it('should return "token" as default if storageKey is empty in oauthConfig', () => {
      oauthConfig.value.storageKey = undefined
      expect(storageKey.value).toBe('token')
    })

    it('should update storageKey in oauthConfig when set', () => {
      storageKey.value = 'new-key'
      expect(oauthConfig.value.storageKey).toBe('new-key')
    })
  })
})
