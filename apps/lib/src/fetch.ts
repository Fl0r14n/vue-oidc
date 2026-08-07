import type { ConfigContext } from './config'
import type { TokenContext } from './token'
import type { OAuthFetch } from './types'

/** The authorized transport, on `fetch`. Axios lives in `vue-oidc/axios` now — it was a required peer
 * dependency for what amounts to two hooks around a request. */
export const createFetch = (
  { isPathIgnored }: Pick<ConfigContext, 'isPathIgnored'>,
  { token, accessToken, checkToken }: Pick<TokenContext, 'token' | 'accessToken' | 'checkToken'>
) => {
  /** The bearer, refreshing first if it is expired. Empty when there is nothing to send, so it can be
   * spread into a headers object unconditionally. */
  const authHeaders = async (url?: string): Promise<Record<string, string>> => {
    if (isPathIgnored(url)) return {}
    await checkToken()
    return (accessToken.value && { Authorization: accessToken.value }) || {}
  }

  /** `fetch`, with the bearer attached and a 401's body stored as the new token state.
   *
   * The body *is* the token state, deliberately: an IdP answers a 401 with an RFC 6749
   * `{error, error_description}`, and storing it verbatim is what lets a session it invalidated behind
   * our back surface as an error rather than as a token that looks fine and fails every call.
   *
   * A body that is empty, HTML or some API's own error shape carries nothing worth keeping, so the
   * session is cleared and no error is recorded — `hasError` stays false and the app just goes
   * signed-out. That is the accepted trade: the alternative is inventing an error the server never sent.
   * Note that this applies to every 401 `oauth.fetch` sees, including a resource-level one from an
   * unrelated endpoint. Register such a path with `oauth.ignorePath()` if it must not touch the session. */
  const oauthFetch: OAuthFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(await authHeaders(url))) {
      headers.set(key, value)
    }
    // Only a string body needs help. The platform extracts `text/plain;charset=UTF-8` from one, so the
    // ordinary `body: JSON.stringify(x)` would go out mislabelled and a strict API answers 415. Every
    // typed body — FormData, Blob, URLSearchParams, ArrayBuffer, a stream — already carries a
    // Content-Type of its own, and defaulting over it would cost a FormData its multipart boundary.
    // Testing for the one shape we can improve rather than listing the ones we must not touch means a
    // body type nobody thought of falls through instead of being mislabelled.
    if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    // Accept is the header that actually asks for JSON back, and an OAuth-protected endpoint is an API
    // far more often than it is a document. Set it on every request, body or not.
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    const response = await fetch(input, { ...init, headers })
    if (401 === response.status) {
      // clone: the caller still has to be able to read the body. The catch is not about the body being
      // uninteresting — it is that an unparseable one must not reject the caller's request.
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
