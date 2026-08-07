import axios, { type AxiosInstance, type CreateAxiosDefaults, type InternalAxiosRequestConfig } from 'axios'
import { getActiveOAuth, type OAuth } from 'vue-oidc'

/** The axios adapter, published as `vue-oidc/axios`.
 *
 * The core speaks `fetch` and has no HTTP client dependency — axios used to be a required peer for every
 * consumer, including the ones who never touched it. This entry keeps the ergonomics for apps that do
 * want interceptors, and it is the only place axios is imported, so the dependency is optional.
 *
 * The core is imported by package name, not relatively, so the bundler keeps it external and this entry
 * resolves the *same* active instance the app installed. A relative import would inline a second copy of
 * the module pointer and every composable here would answer with an instance nobody installed. */

/** Attaches the bearer, refreshing an expired token first, and skips URLs registered with
 * `oauth.ignorePath()`. */
export const authorizationInterceptor =
  (oauth: OAuth) =>
  async (req: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    for (const [key, value] of Object.entries(await oauth.authHeaders(req.url))) {
      req.headers.set(key, value)
    }
    return req
  }

/** Stores a 401's body as the new token state, so a session the IdP invalidated behind our back surfaces
 * as an error instead of a token that looks fine and fails every call — see the same branch in the core's
 * `fetch.ts`. Re-rejects: this is not error handling, it is bookkeeping. */
export const unauthorizedInterceptor = (oauth: OAuth) => (error: any) => {
  if (401 === error?.response?.status) {
    // axios hands `data` over as a string when the body is HTML or empty, and a string is not token state
    const { data } = error.response
    oauth.token.value = (typeof data === 'object' && data) || {}
  }
  return Promise.reject(error)
}

export interface AxiosInterceptors {
  authorizationInterceptor: (req: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>
  unauthorizedInterceptor: (error: any) => Promise<never>
}

/** For attaching to an axios instance you already have. */
export const createAxiosInterceptors = (oauth: OAuth): AxiosInterceptors => ({
  authorizationInterceptor: authorizationInterceptor(oauth),
  unauthorizedInterceptor: unauthorizedInterceptor(oauth)
})

/** A fresh axios instance with both interceptors attached.
 *
 * One per OAuth instance, never a shared default: on the server two concurrent requests sharing
 * interceptors would mean one request's bearer on another request's call. */
export const createAxiosClient = (oauth: OAuth, defaults?: CreateAxiosDefaults): AxiosInstance => {
  const client = axios.create({ headers: { 'Content-Type': 'application/json' }, ...defaults })
  const { authorizationInterceptor: onRequest, unauthorizedInterceptor: onError } = createAxiosInterceptors(oauth)
  client.interceptors.request.use(onRequest)
  client.interceptors.response.use(response => response, onError)
  return client
}

// One client per OAuth instance. Callers attach their own interceptors to what useOAuthHttp() returns and
// then read it back from an unrelated store or component, so every call has to answer with the same
// object — a fresh client per call would drop those interceptors on the floor silently.
//
// Weak and keyed by the instance, which is the scope that matters: a module-level singleton would let two
// concurrent SSR renders cross interceptors, and here a request's client is unreachable — and collectable
// — the moment its instance is.
const clients = new WeakMap<OAuth, AxiosInstance>()

/** The instance's authorized axios client, resolved like every other composable (injection context first,
 * active-instance pointer outside one). Memoized per OAuth instance: interceptors added at one call site
 * are visible at every other, which is what consumers build on.
 *
 * Takes no defaults, deliberately — with several call sites sharing the client, whichever ran first would
 * silently decide them. Use `createAxiosClient(oauth, defaults)` for a separately configured client. */
export const useOAuthHttp = (): AxiosInstance => {
  const oauth = getActiveOAuth()
  const existing = clients.get(oauth)
  if (existing) return existing
  const client = createAxiosClient(oauth)
  clients.set(oauth, client)
  return client
}

/** The interceptor pair for the active instance, for attaching to a client you built yourself. */
export const useOAuthInterceptors = (): AxiosInterceptors => createAxiosInterceptors(getActiveOAuth())
