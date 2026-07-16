import { computed, watch } from 'vue'
import type { ConfigContext } from './config'
import { storageRef } from './ref'
import type { OAuthFunctions, OAuthToken, OpenIdConfig } from './types'
import { OAuthStatus } from './types'

export const isExpiredToken = (token?: OAuthToken) => (token?.expires && Date.now() > token.expires) || false

export const createToken = ({ config, storageKey }: Pick<ConfigContext, 'config' | 'storageKey'>, functions: OAuthFunctions) => {
  const token = storageRef<OAuthToken>(storageKey, {})

  const type = computed(() => token.value?.type)

  const accessToken = computed(() => {
    const { token_type, access_token } = token.value || {}
    return (token_type && access_token && `${token_type} ${access_token}`) || undefined
  })

  const status = computed(() => {
    const { value } = token
    return (
      (value?.error && OAuthStatus.DENIED) ||
      (value?.access_token && !isExpiredToken(value) && OAuthStatus.AUTHORIZED) ||
      OAuthStatus.NOT_AUTHORIZED
    )
  })

  const isAuthorized = computed(() => status.value === OAuthStatus.AUTHORIZED)

  const error = computed(() => token.value.error)

  const hasError = computed(() => !!error.value)

  const errorDescription = computed(() => token.value.error_description)

  const autoconfigOauth = async () => {
    const c = (config.value || {}) as OpenIdConfig
    if (!(c.tokenPath || c.authorizePath)) {
      const v = await functions.openIdConfiguration(c)
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

  const checkToken = () => {
    if (inFlight) return inFlight
    inFlight = (async () => {
      const t = token.value
      if (isExpiredToken(t)) {
        await autoconfigOauth()
        const refreshed = await functions.refresh(t, config.value)
        if (refreshed && !isExpiredToken(refreshed)) {
          if (refreshed.error) {
            // RFC 6749 §5.2 error (e.g. invalid_grant) — persist it like the 401 interceptor so the dead token is dropped
            token.value = refreshed
          } else {
            //keep the refresh token cuz we might not get a new one
            setExpires({ refresh_token: t.refresh_token, ...refreshed })
          }
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

  return {
    token,
    type,
    accessToken,
    status,
    isAuthorized,
    error,
    hasError,
    errorDescription,
    autoconfigOauth,
    checkToken
  }
}

export type TokenContext = ReturnType<typeof createToken>
