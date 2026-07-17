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

  const ignorePath = (pattern: RegExp) => {
    oauthConfig.value.ignorePaths ??= []
    const paths = oauthConfig.value.ignorePaths
    if (!paths.some(p => p.source === pattern.source && p.flags === pattern.flags)) {
      paths.push(pattern)
    }
  }

  const isPathIgnored = (url?: string) => (!!url && oauthConfig.value.ignorePaths?.some(pattern => pattern.test(url))) || false

  const storageKey = computed({
    get: () => oauthConfig.value.storageKey || 'token',
    set: storageKey => (oauthConfig.value.storageKey = storageKey)
  })

  const strictJwt = computed(() => oauthConfig.value.strictJwt)

  return {
    oauthConfig,
    config,
    ignorePath,
    isPathIgnored,
    storageKey,
    strictJwt
  }
}

export type ConfigContext = ReturnType<typeof createConfig>
