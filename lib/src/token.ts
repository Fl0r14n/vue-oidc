import type { OAuthToken, OpenIdConfig } from '@/models'
import { OAuthStatus } from '@/models'
import { computed, watch } from 'vue'
import { config, storageKey } from '@/config'
import { storageRef } from '@/ref'
import { oauthFunctions } from '@/functions'

export const token = storageRef<OAuthToken>(storageKey, {})

export const isExpiredToken = (token?: OAuthToken) => (token?.expires && Date.now() > token.expires) || false

watch(token, async t => {
  const expiresIn = Number(t?.expires_in) || 0
  if (expiresIn) {
    if (!t.expires) {
      token.value = {
        ...t,
        ...{ expires: Date.now() + expiresIn * 1000 }
      }
    } else if (isExpiredToken(t)) {
      token.value = {
        ...(await oauthFunctions.refresh(token.value, config.value as OpenIdConfig)),
      }
    }
  }
})

export const type = computed(() => token.value?.type)

export const accessToken = computed(() => {
  const { token_type, access_token } = token.value || {}
  return (token_type && access_token && `${token_type} ${access_token}`) || undefined
})

export const status = computed(() => {
  const { value } = token
  return (
    (value?.error && OAuthStatus.DENIED) ||
    (value?.access_token && !isExpiredToken(value) && OAuthStatus.AUTHORIZED) ||
    OAuthStatus.NOT_AUTHORIZED
  )
})

export const isAuthorized = computed(() => status.value === OAuthStatus.AUTHORIZED)

export const error = computed(() => token.value.error)

export const hasError = computed(() => !!error.value)

export const errorDescription = computed(() => token.value.error_description)
