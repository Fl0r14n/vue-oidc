import { config } from '@/config'
import { authorize, clientCredentialLogin, getOpenIDConfiguration, resourceLogin, revoke } from '@/http'
import type { AuthorizationParameters, OAuthParameters, OpenIdConfig, ResourceParameters } from '@/models'
import { OAuthType } from '@/models'
import { token } from '@/token'
import { jwt } from '@/user'
import { ref } from 'vue'

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
    const nonce = randomString(10)
    token.value = { ...token.value, nonce }
    return `&nonce=${nonce}`
  }
  return ''
}

const checkNonce = (parameters: Record<string, string>) => {
  if (jwt(parameters.id_token)?.nonce !== token.value?.nonce) {
    return {
      error: 'Invalid nonce'
    }
  }
  return parameters
}

const generateCodeChallenge = async (doPkce: any) => {
  if (doPkce) {
    const codeVerifier = randomString()
    token.value = { ...token.value, codeVerifier }
    return `&code_challenge=${await pkce(codeVerifier)}&code_challenge_method=S256`
  }
  return ''
}

const toAuthorizationUrl = async (parameters: AuthorizationParameters) => {
  const { authorizePath, clientId, scope, pkce } = config.value as any
  let authorizationUrl = `${authorizePath}`
  authorizationUrl += (authorizePath.includes('?') && '&') || '?'
  authorizationUrl += `client_id=${clientId}`
  token.value = { ...token.value, redirectUri: parameters.redirectUri }
  authorizationUrl += `&redirect_uri=${encodeURIComponent(parameters.redirectUri)}`
  authorizationUrl += `&response_type=${parameters.responseType}`
  authorizationUrl += `&scope=${encodeURIComponent(scope || '')}`
  authorizationUrl += `&state=${encodeURIComponent(parameters.state || '')}`
  return globalThis.location?.replace(`${authorizationUrl}${generateNonce(scope)}${await generateCodeChallenge(pkce)}`)
}

const parseOauthUri = (hash: string) => {
  const regex = /([^&=]+)=([^&]*)/g
  const params: Record<string, string> = {}
  let m
  // tslint:disable-next-line:no-conditional-assignment
  while ((m = regex.exec(hash)) !== null) {
    params[decodeURIComponent(m[1])] = decodeURIComponent(m[2])
  }
  return (Object.keys(params).length && params) || {}
}

export const state = ref<string>()

export const login = async (parameters?: OAuthParameters) => {
  await autoconfigOauth()
  if (!!parameters && (parameters as ResourceParameters).password) {
    token.value = await resourceLogin(parameters as ResourceParameters)
  } else if (!!parameters && (parameters as AuthorizationParameters).redirectUri && (parameters as AuthorizationParameters).responseType) {
    await toAuthorizationUrl(parameters as AuthorizationParameters)
  } else {
    token.value = await clientCredentialLogin()
  }
}

export const logout = async (logoutRedirectUri?: string) => {
  await autoconfigOauth()
  const { logoutPath, clientId } = config.value as any
  if (logoutRedirectUri && logoutPath) {
    const { id_token } = token.value
    const tokenHint = (id_token && `&id_token_hint=${id_token}`) || ''
    const logoutUrl = `${logoutPath}?client_id=${clientId}&post_logout_redirect_uri=${logoutRedirectUri}${tokenHint}`
    token.value = {}
    globalThis.location?.replace(logoutUrl)
  } else {
    await revoke(token.value)
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
      ...checkNonce(parameters),
      type: OAuthType.IMPLICIT
    }
    state.value = parameters?.state
  } else if (isAuthCodeRedirect) {
    const parameters = parseOauthUri((search && search.substring(1)) || (hash && hash.substring(1)))
    token.value = {
      ...token.value,
      ...parameters,
      type: OAuthType.AUTHORIZATION_CODE
    }
    state.value = parameters?.state
    await autoconfigOauth()
    await checkCode(token.value?.code)
  }
}

const autoconfigOauth = async () => {
  const { issuerPath, tokenPath } = config.value as OpenIdConfig
  if (!tokenPath && issuerPath) {
    const v = await getOpenIDConfiguration()
    config.value = {
      ...((v?.authorization_endpoint && { authorizePath: v.authorization_endpoint }) || {}),
      ...((v?.token_endpoint && { tokenPath: v.token_endpoint }) || {}),
      ...((v?.revocation_endpoint && { revokePath: v.revocation_endpoint }) || {}),
      ...((v?.code_challenge_methods_supported && { pkce: v.code_challenge_methods_supported.indexOf('S256') > -1 }) || {}),
      ...((v?.userinfo_endpoint && { userPath: v.userinfo_endpoint }) || {}),
      ...((v?.introspection_endpoint && { introspectionPath: v.introspection_endpoint }) || {}),
      ...((v?.end_session_endpoint && { logoutPath: v.end_session_endpoint }) || {}),
      ...{ scope: config.value?.scope || 'openid' }
    } as OpenIdConfig
  }
}

const checkCode = async (code?: string) => {
  const { tokenPath } = config.value as OpenIdConfig
  const { codeVerifier, redirectUri } = token.value || {} //should be set by authorizationUrl construction
  const { origin, pathname } = globalThis.location || {}
  if (code && tokenPath) {
    const parameters = await authorize(code, redirectUri || `${origin}${pathname}`, codeVerifier)
    token.value = checkNonce(parameters)
  }
}
