import axios, { type AxiosInstance, type CreateAxiosDefaults, type InternalAxiosRequestConfig } from 'axios'
import { type App, hasInjectionContext, type InjectionKey, inject } from 'vue'
import { createOAuth, type OAuth, type OAuthConfig } from 'vue-oidc'

/** The axios adapter, published as `vue-oidc/axios`.
 *
 * The core speaks `fetch` and has no HTTP client dependency — axios used to be a required peer for every
 * consumer, including the ones who never touched it. This entry keeps the ergonomics for apps that do
 * want interceptors, and it is the only place axios is imported, so the dependency is optional. That is
 * also why the composition lives here rather than behind a `createOAuth(cfg, withAxios)` flag: a flag
 * would put an axios branch in the core entry and the separate build would stop meaning anything.
 *
 * The core is imported by package name, not relatively, so the bundler keeps it external and this entry
 * sees the same `oauthKey` the app provided to. A relative import would inline a second copy of it and
 * every composable here would resolve nothing. */

export const axiosInterceptors = (oauth: OAuth) => ({
  authorizationInterceptor: async (req: InternalAxiosRequestConfig) => {
    for (const [key, value] of Object.entries(await oauth.authHeaders(req.url))) {
      req.headers.set(key, value)
    }
    return req
  },
  unauthorizedInterceptor: (error: any) => {
    if (401 === error?.response?.status) {
      // a string body (HTML, empty, a proxy's plain-text error) is not token state
      const { data } = error.response
      oauth.token.value = (typeof data === 'object' && data) || {}
    }
    return Promise.reject(error)
  }
})

/** A fresh axios instance with both interceptors attached.
 *
 * One per OAuth instance, never a shared default: on the server two concurrent requests sharing
 * interceptors would mean one request's bearer on another request's call. */
export const createAxiosClient = (oauth: OAuth, defaults?: CreateAxiosDefaults): AxiosInstance => {
  const client = axios.create({ headers: { 'Content-Type': 'application/json' }, ...defaults })
  const { authorizationInterceptor: onRequest, unauthorizedInterceptor: onError } = axiosInterceptors(oauth)
  client.interceptors.request.use(onRequest)
  client.interceptors.response.use(response => response, onError)
  return client
}

export const httpKey: InjectionKey<AxiosInstance> = Symbol('vue-oidc/axios')
export type AxiosOAuth = OAuth & { http: AxiosInstance }

export const createAxiosOAuth = (cfg?: OAuthConfig, defaults?: CreateAxiosDefaults): AxiosOAuth => {
  const oauth = createOAuth(cfg)
  const http = createAxiosClient(oauth, defaults)
  const install = oauth.install
  return Object.assign(oauth, {
    http,
    install: (app: App) => {
      install(app)
      app.provide(httpKey, http)
      // v4 provided the axios client under the plain 'http' key; keep it for `inject('http')` callers
      app.provide('http', http)
    }
  })
}

export const useOAuthHttp = (): AxiosInstance => {
  const http = hasInjectionContext() && inject(httpKey, undefined)
  if (!http) {
    throw new Error(
      '[vue-oidc/axios]: no axios client in this injection context. Create the instance with createAxiosOAuth() instead of createOAuth() and install it with app.use(), then resolve inside a component/store setup, a navigation guard (before the first await), or app.runWithContext(). To manage a client yourself, use createAxiosClient(oauth).'
    )
  }
  return http
}
