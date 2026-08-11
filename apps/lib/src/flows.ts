import { ref } from 'vue'
import type { ConfigContext } from './config'
import type { Jwt } from './jwt'
import type { TokenContext } from './token'
import type {
  AuthorizationCodeParameters,
  ClientCredentialConfig,
  OAuthFunctions,
  OAuthParameters,
  OpenIdConfig,
  ResourceOwnerConfig,
  ResourceOwnerParameters
} from './types'
import { OAuthType } from './types'

const arrToString = (buf: Uint8Array) => buf.reduce((s, b) => s + String.fromCharCode(b), '')
const base64url = (str: string) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

const randomString = (length: number = 48) => {
  const buff = arrToString(crypto.getRandomValues(new Uint8Array(length * 2)))
  return base64url(buff).substring(0, length)
}

const pkce = async (value: string) => {
  const buff = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64url(arrToString(new Uint8Array(buff)))
}

const parseOauthUri = (hash: string) => {
  const params = Object.fromEntries(new URLSearchParams(hash))
  return (Object.keys(params).length && params) || {}
}

const generateNonce = (scope: string) => (scope.indexOf('openid') > -1 ? randomString() : undefined)

const generatePkcePair = async () => {
  const code_verifier = randomString()
  return { code_verifier, code_challenge: await pkce(code_verifier) }
}

export const createFlows = (
  { config }: Pick<ConfigContext, 'config'>,
  { token, autoconfigOauth }: Pick<TokenContext, 'token' | 'autoconfigOauth'>,
  functions: OAuthFunctions,
  jwt: Jwt
) => {
  const checkNonce = async (parameters: Record<string, string>) => {
    if (parameters.error) return parameters
    const payload = await jwt(parameters.id_token)
    if (payload?.error || payload?.nonce !== token.value?.nonce) {
      return { error: (payload?.error as string) || 'Invalid nonce' }
    }
    return parameters
  }

  const toAuthorizationUrl = async (parameters: AuthorizationCodeParameters) => {
    const { authorizePath, clientId, scope = '', pkce: usePkce } = config.value as any
    const nonce = generateNonce(scope)
    const pkcePair = usePkce ? await generatePkcePair() : undefined
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: parameters.redirectUri,
      response_type: parameters.responseType,
      scope,
      state: parameters.state || ''
    })
    if (parameters.accessType) {
      params.set('access_type', parameters.accessType)
      params.set('prompt', parameters.prompt || '')
    }
    if (nonce) {
      params.set('nonce', nonce)
    }
    if (pkcePair) {
      params.set('code_challenge', pkcePair.code_challenge)
      params.set('code_challenge_method', 'S256')
    }
    token.value = {
      redirect_uri: parameters.redirectUri,
      ...(nonce && { nonce }),
      ...(pkcePair && { code_verifier: pkcePair.code_verifier })
    }
    const url = `${authorizePath}${authorizePath.includes('?') ? '&' : '?'}${params}`
    globalThis.location?.replace(url)
    return url
  }

  const checkCode = async () => {
    const parameters = await functions.authorize(token.value, config.value)
    if (parameters) {
      token.value = await checkNonce(parameters)
    }
  }

  const state = ref<string>()

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
    const path = (url && new URL(url)) || globalThis.location || {}
    const { hash, search } = path
    const isImplicitRedirect = hash && /(access_token=)|(error=)/.test(hash)
    const isAuthCodeRedirect = (search && /(code=)|(error=)/.test(search)) || (hash && /(code=)|(error=)/.test(hash))
    if (isImplicitRedirect) {
      const parameters = parseOauthUri(hash.substring(1))
      token.value = {
        ...(await checkNonce(parameters)),
        type: OAuthType.IMPLICIT
      }
      state.value = parameters?.state
    } else if (isAuthCodeRedirect) {
      const parameters = parseOauthUri(search?.substring(1) || hash?.substring(1))
      token.value = {
        ...token.value,
        ...parameters
        // do not set type yet. will be set by authorize function since it is a two-step process
      }
      state.value = parameters?.state
      await autoconfigOauth()
      await checkCode()
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
