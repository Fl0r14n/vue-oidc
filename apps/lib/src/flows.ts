import { ref } from 'vue'
import type { ConfigContext } from './config'
import { beginAuthorization, completeAuthorization } from './core/flow'
import { parseRedirectParameters } from './core/redirect'
import type {
  AuthorizationCodeParameters,
  ClientCredentialConfig,
  OAuthFunctions,
  OAuthParameters,
  OpenIdConfig,
  ResourceOwnerConfig,
  ResourceOwnerParameters
} from './core/types'
import type { Jwt } from './jwt'
import type { TokenContext } from './token'

export const createFlows = (
  { config }: Pick<ConfigContext, 'config'>,
  { token, autoconfigOauth }: Pick<TokenContext, 'token' | 'autoconfigOauth'>,
  functions: OAuthFunctions,
  jwt: Jwt
) => {
  const state = ref<string>()

  const toAuthorizationUrl = async (parameters: AuthorizationCodeParameters) => {
    const { url, handoff } = await beginAuthorization(config.value, parameters, { functions })
    token.value = handoff
    globalThis.location?.replace(url)
    return url
  }

  const login = async (parameters?: OAuthParameters) => {
    await autoconfigOauth()
    if (parameters && (parameters as ResourceOwnerParameters).password) {
      token.value = (await functions.resourceOwnerLogin(parameters as ResourceOwnerParameters, config.value as ResourceOwnerConfig)) || {}
    } else if (
      parameters &&
      (parameters as AuthorizationCodeParameters).redirectUri &&
      (parameters as AuthorizationCodeParameters).responseType
    ) {
      return await toAuthorizationUrl(parameters as AuthorizationCodeParameters)
    } else {
      token.value = (await functions.clientCredentialLogin(config.value as ClientCredentialConfig)) || {}
    }
  }

  const logout = async (logoutRedirectUri?: string, state?: string) => {
    await autoconfigOauth()
    const { logoutPath, clientId, logoutRedirectUri: configLogoutRedirectUri } = (config.value as OpenIdConfig) || {}
    const returnUri = logoutRedirectUri || configLogoutRedirectUri
    if (returnUri && logoutPath) {
      const { id_token } = token.value
      const params = new URLSearchParams({ post_logout_redirect_uri: returnUri })
      if (clientId) {
        params.set('client_id', clientId)
      }
      if (id_token) {
        params.set('id_token_hint', id_token)
      }
      if (state) {
        params.set('state', state)
      }
      token.value = {}
      globalThis.location?.replace(`${logoutPath}${logoutPath.includes('?') ? '&' : '?'}${params}`)
    } else {
      try {
        await functions.revoke(token.value, config.value)
      } finally {
        token.value = {}
      }
    }
  }

  const oauthCallback = async (url?: string | URL) => {
    // do not run in SSR, verifiers sit in users browser storage
    if (typeof window === 'undefined') return
    const source = url || globalThis.location
    const { flow, parameters } = parseRedirectParameters(source)
    if (flow === 'none') return
    state.value = parameters.state
    if (flow === 'code') {
      await autoconfigOauth()
    }
    const result = await completeAuthorization(config.value, source, token.value, { functions, verifyIdToken: jwt })
    if (result) {
      token.value = result
    }
  }

  return {
    state,
    login,
    logout,
    oauthCallback
  }
}

export type FlowsContext = ReturnType<typeof createFlows>
