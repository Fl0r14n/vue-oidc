import { ref } from 'vue'
import { config } from './config'
import { oauthFunctions } from './functions'
import { verifyJwt } from './jwt'
import { token } from './token'
import type {
  AuthorizationCodeParameters,
  ClientCredentialConfig,
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

const generateNonce = (scope: string) => {
  if (scope.indexOf('openid') > -1) {
    const nonce = randomString()
    token.value = { ...token.value, nonce }
    return `&nonce=${nonce}`
  }
  return ''
}

const checkNonce = async (parameters: Record<string, string>) => {
  if (parameters.error) return parameters
  const payload = await verifyJwt(parameters.id_token)
  if (payload?.error || payload?.nonce !== token.value?.nonce) {
    return { error: (payload?.error as string) || 'Invalid nonce' }
  }
  return parameters
}

const generateCodeChallenge = async (doPkce: any) => {
  if (doPkce) {
    const code_verifier = randomString()
    token.value = { ...token.value, code_verifier }
    return `&code_challenge=${await pkce(code_verifier)}&code_challenge_method=S256`
  }
  return ''
}

const toAuthorizationUrl = async (parameters: AuthorizationCodeParameters) => {
  const { authorizePath, clientId, scope = '', pkce } = config.value as any
  let authorizationUrl = `${authorizePath}`
  authorizationUrl += (authorizePath.includes('?') && '&') || '?'
  authorizationUrl += `client_id=${clientId}`
  token.value = { ...token.value, redirect_uri: parameters.redirectUri }
  authorizationUrl += `&redirect_uri=${encodeURIComponent(parameters.redirectUri)}`
  authorizationUrl += `&response_type=${parameters.responseType}`
  authorizationUrl += `&scope=${encodeURIComponent(scope)}`
  authorizationUrl += `&state=${encodeURIComponent(parameters.state || '')}`
  return globalThis.location?.replace(`${authorizationUrl}${generateNonce(scope)}${await generateCodeChallenge(pkce)}`)
}

const parseOauthUri = (hash: string) => {
  const params = Object.fromEntries(new URLSearchParams(hash))
  return (Object.keys(params).length && params) || {}
}

export const state = ref<string>()

export const login = async (parameters?: OAuthParameters) => {
  await autoconfigOauth()
  if (!!parameters && (parameters as ResourceOwnerParameters).password) {
    token.value =
      (await oauthFunctions.resourceOwnerLogin(parameters as ResourceOwnerParameters, config.value as ResourceOwnerConfig)) || {}
  } else if (
    !!parameters &&
    (parameters as AuthorizationCodeParameters).redirectUri &&
    (parameters as AuthorizationCodeParameters).responseType
  ) {
    await toAuthorizationUrl(parameters as AuthorizationCodeParameters)
  } else {
    token.value = (await oauthFunctions.clientCredentialLogin(config.value as ClientCredentialConfig)) || {}
  }
}

export const logout = async (logoutRedirectUri?: string, state?: string) => {
  await autoconfigOauth()
  const { logoutPath, clientId } = (config.value as OpenIdConfig) || {}
  if (logoutRedirectUri && logoutPath) {
    const { id_token } = token.value
    const tokenHint = (id_token && `&id_token_hint=${id_token}`) || ''
    const stateFwd = (state && `&state=${state}`) || ''
    const logoutUrl = `${logoutPath}?client_id=${clientId}&post_logout_redirect_uri=${logoutRedirectUri}${tokenHint}${stateFwd}`
    token.value = {}
    globalThis.location?.replace(logoutUrl)
  } else {
    await oauthFunctions.revoke(token.value, config.value as OpenIdConfig)
    token.value = {}
  }
}

export const oauthCallback = async (url?: string) => {
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

const autoconfigOauth = async () => {
  const v = await oauthFunctions.openIdConfiguration(config.value as OpenIdConfig)
  if (v) {
    config.value = {
      ...((v?.authorization_endpoint && { authorizePath: v.authorization_endpoint }) || {}),
      ...((v?.token_endpoint && { tokenPath: v.token_endpoint }) || {}),
      ...((v?.revocation_endpoint && { revokePath: v.revocation_endpoint }) || {}),
      ...((v?.userinfo_endpoint && { userPath: v.userinfo_endpoint }) || {}),
      ...((v?.introspection_endpoint && { introspectionPath: v.introspection_endpoint }) || {}),
      ...((v?.end_session_endpoint && { logoutPath: v.end_session_endpoint }) || {}),
      ...((v?.jwks_uri && { jwksUri: v.jwks_uri }) || {}),
      ...(((config.value as any)?.pkce === undefined &&
        v?.code_challenge_methods_supported && { pkce: v.code_challenge_methods_supported.indexOf('S256') > -1 }) ||
        {}),
      ...{ scope: config.value?.scope || 'openid' }
    }
  }
}

const checkCode = async () => {
  const parameters = await oauthFunctions.authorize(token.value, config.value as OpenIdConfig)
  if (parameters) {
    token.value = await checkNonce(parameters)
  }
}
