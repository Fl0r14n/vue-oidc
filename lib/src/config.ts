import type { OAuthConfig, OAuthTypeConfig } from '@/models'
import { computed, ref } from 'vue'

export const oauthConfig = ref<OAuthConfig>({
  storageKey: 'token',
  ignorePaths: []
})

export const config = computed({
  get: () => oauthConfig.value.config,
  set: config =>
    (oauthConfig.value.config = {
      ...oauthConfig.value.config,
      ...config
    } as OAuthTypeConfig)
})

export const ignoredPaths = computed(() => oauthConfig.value.ignorePaths)

export const storageKey = computed({
  get: () => oauthConfig.value.storageKey || 'token',
  set: storageKey => (oauthConfig.value.storageKey = storageKey)
})
