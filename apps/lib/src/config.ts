import { computed, ref } from 'vue'
import type { OAuthConfig, OAuthTypeConfig } from './types'

export const createConfig = (cfg?: OAuthConfig) => {
  const oauthConfig = ref<OAuthConfig>({
    storageKey: 'token',
    ignorePaths: [],
    strictJwt: true,
    ...cfg
  })

  const config = computed({
    get: () => oauthConfig.value.config,
    set: config =>
      (oauthConfig.value.config = {
        ...oauthConfig.value.config,
        ...config
      } as OAuthTypeConfig)
  })

  const ignoredPaths = computed(() => oauthConfig.value.ignorePaths)

  const storageKey = computed({
    get: () => oauthConfig.value.storageKey || 'token',
    set: storageKey => (oauthConfig.value.storageKey = storageKey)
  })

  const strictJwt = computed(() => oauthConfig.value.strictJwt)

  return {
    oauthConfig,
    config,
    ignoredPaths,
    storageKey,
    strictJwt
  }
}

export type ConfigContext = ReturnType<typeof createConfig>
