import { computed, watch } from 'vue'
import { config, storageKey } from './config'
import { oauthFunctions } from './functions'
import { storageRef } from './ref'
import type { OAuthToken, OpenIdConfig } from './types'
import { OAuthStatus } from './types'

export const token = storageRef<OAuthToken>(storageKey, {})

const isExpiredToken = (token?: OAuthToken) => (token?.expires && Date.now() > token.expires) || false

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

export const autoconfigOauth = async () => {
  const c = config.value as OpenIdConfig
  if (!(c.tokenPath || c.authorizePath)) {
    const v = await oauthFunctions.openIdConfiguration(c)
    if (v) {
      config.value = {
        ...c,
        ...(v?.authorization_endpoint && { authorizePath: v.authorization_endpoint }),
        ...(v?.token_endpoint && { tokenPath: v.token_endpoint }),
        ...(v?.revocation_endpoint && { revokePath: v.revocation_endpoint }),
        ...(v?.userinfo_endpoint && { userPath: v.userinfo_endpoint }),
        ...(v?.introspection_endpoint && { introspectionPath: v.introspection_endpoint }),
        ...(v?.end_session_endpoint && { logoutPath: v.end_session_endpoint }),
        ...(v?.jwks_uri && { jwksUri: v.jwks_uri }),
        ...(c?.pkce === undefined &&
          v?.code_challenge_methods_supported && { pkce: v.code_challenge_methods_supported.indexOf('S256') > -1 }),
        scope: config.value?.scope || 'openid'
      }
    }
  }
}

const setExpires = (t: OAuthToken) => {
  const expiresIn = Number(t?.expires_in) || 0
  if (expiresIn && !t.expires) {
    token.value = {
      ...t,
      expires: Date.now() + expiresIn * 1e3
    }
  }
}

let inFlight: Promise<void> | undefined

export const checkToken = () => {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const t = token.value
    if (isExpiredToken(t)) {
      await autoconfigOauth()
      const refreshed = await oauthFunctions.refresh(t, config.value)
      if (refreshed && !isExpiredToken(refreshed)) {
        //keep the refresh token cuz we might not get a new one
        setExpires({ refresh_token: t.refresh_token, ...refreshed })
      }
    } else {
      setExpires(t)
    }
  })().finally(() => (inFlight = undefined))
  return inFlight
}

watch(
  [config, accessToken],
  async ([c, a]) => {
    if (c && a) {
      await checkToken()
    }
  },
  { immediate: true }
)
