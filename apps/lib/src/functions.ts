import { type OAuthFetch, type OAuthFunctions, OAuthType } from './types'

const FORM_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json'
}

const form = (fields: Record<string, string | undefined>) => {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      body.set(key, value)
    }
  }
  return body
}

const request = async (url: string, init?: RequestInit, fetchImpl: OAuthFetch = fetch): Promise<any> => {
  try {
    const response = await fetchImpl(url, init)
    return await response.json().catch(() => undefined)
  } catch {
    return undefined
  }
}

const post = (url: string, fields: Record<string, string | undefined>, headers?: Record<string, string>) =>
  request(url, { method: 'POST', headers: { ...FORM_HEADERS, ...headers }, body: form(fields) })

export const defaultOAuthFunctions: OAuthFunctions = {
  refresh: async (token, config) => {
    const { tokenPath, clientId, clientSecret, scope } = config || {}
    const { refresh_token, type } = token || {}
    if (!refresh_token || !tokenPath) return token
    const refreshed = await post(tokenPath, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token,
      scope
    })
    return (refreshed && { ...refreshed, type }) || token
  },

  revoke: async (token, config) => {
    const { revokePath, clientId, clientSecret } = config || {}
    if (!revokePath) return
    const { access_token, refresh_token } = token || {}
    // both, and in this order: an IdP that only honours one still ends up with nothing usable
    for (const [value, hint] of [
      [access_token, 'access_token'],
      [refresh_token, 'refresh_token']
    ] as const) {
      if (value) {
        await post(revokePath, { client_id: clientId, client_secret: clientSecret, token: value, token_type_hint: hint })
      }
    }
  },

  authorize: async (token, config) => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    const { code, redirect_uri, code_verifier } = token || {}
    if (!code || !tokenPath) return token
    const exchanged = await post(tokenPath, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri,
      grant_type: 'authorization_code',
      scope,
      code_verifier
    })
    return (exchanged && { ...exchanged, type: OAuthType.AUTHORIZATION_CODE }) || token
  },

  clientCredentialLogin: async config => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    if (!tokenPath) return undefined
    const token = await post(tokenPath, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: OAuthType.CLIENT_CREDENTIAL,
      scope
    })
    return (token && { ...token, type: OAuthType.CLIENT_CREDENTIAL }) || undefined
  },

  resourceOwnerLogin: async (parameters, config) => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    const { username, password } = parameters
    if (!tokenPath || !clientId) return undefined
    const token = await post(tokenPath, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: OAuthType.RESOURCE,
      scope,
      username,
      password
    })
    return (token && { ...token, type: OAuthType.RESOURCE }) || undefined
  },

  openIdConfiguration: async config => {
    const { issuerPath, clientId } = config || {}
    if (!issuerPath) return undefined
    const url = new URL(`${issuerPath}/.well-known/openid-configuration`)
    if (clientId) {
      url.searchParams.set('client_id', clientId)
    }
    return (await request(url.toString(), { headers: { Accept: 'application/json' } })) || undefined
  },

  userInfo: async (config, oauthFetch = fetch) => {
    const { userPath } = config || {}
    if (!userPath) return undefined
    // the instance's authorized fetch by default, so the bearer is attached
    return (await request(userPath, { headers: { Accept: 'application/json' } }, oauthFetch)) || undefined
  },

  introspect: async (token, config) => {
    const { introspectionPath, clientId, clientSecret } = config || {}
    const { access_token } = token || {}
    if (!introspectionPath || !access_token || !clientId) return undefined
    return (
      (await post(introspectionPath, { token: access_token }, { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` })) ||
      undefined
    )
  }
}
