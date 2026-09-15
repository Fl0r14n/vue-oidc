import type { ConfigContext } from './config'
import type { OAuthFetch } from './core/types'
import type { TokenContext } from './token'

export const createFetch = (
  { isPathIgnored }: Pick<ConfigContext, 'isPathIgnored'>,
  { token, accessToken, checkToken }: Pick<TokenContext, 'token' | 'accessToken' | 'checkToken'>
) => {
  const authHeaders = async (url?: string): Promise<Record<string, string>> => {
    if (isPathIgnored(url)) return {}
    await checkToken()
    return (accessToken.value && { Authorization: accessToken.value }) || {}
  }

  const oauthFetch: OAuthFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(await authHeaders(url))) {
      headers.set(key, value)
    }
    if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    const response = await fetch(input, { ...init, headers })
    if (401 === response.status) {
      const body = await response
        .clone()
        .json()
        .catch(() => undefined)
      token.value = (typeof body === 'object' && body) || {}
    }
    return response
  }

  return { authHeaders, oauthFetch }
}

export type FetchContext = ReturnType<typeof createFetch>
