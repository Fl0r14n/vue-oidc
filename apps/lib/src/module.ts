import { type App, effectScope, hasInjectionContext, type InjectionKey, inject } from 'vue'
import { createConfig } from './config'
import { createFetch } from './fetch'
import { createFlows } from './flows'
import { defaultOAuthFunctions } from './functions'
import { createJwt } from './jwt'
import { createToken, isExpiredToken } from './token'
import type { OAuth, OAuthConfig } from './types'
import { createUser } from './user'

export const oauthKey: InjectionKey<OAuth> = Symbol('vue-oidc')

export const getActiveOAuth = (): OAuth => {
  const instance = hasInjectionContext() && inject(oauthKey, undefined)
  if (!instance) {
    throw new Error(
      '[vue-oidc]: no OAuth instance in this injection context. Install one with app.use(createOAuth()) and resolve it inside a component/store setup, a navigation guard (before the first await), or app.runWithContext(). Outside a context, hold the instance createOAuth() returned.'
    )
  }
  return instance
}

export const createOAuth = (cfg?: OAuthConfig): OAuth => {
  const scope = effectScope(true)
  return scope.run(() => {
    const configContext = createConfig(cfg)
    const functions = { ...defaultOAuthFunctions, ...cfg?.functions }
    const jwt = createJwt(configContext)
    const tokenContext = createToken(configContext, functions)
    const fetchContext = createFetch(configContext, tokenContext)
    const flows = createFlows(configContext, tokenContext, functions, jwt)
    const { user } = createUser(configContext, tokenContext, fetchContext, functions, jwt)
    const { oauthConfig, config, ignorePath, storageKey } = configContext
    const { token, type, accessToken, status, isAuthorized, error, hasError, errorDescription, autoconfigOauth, checkToken } = tokenContext
    const { authHeaders, oauthFetch } = fetchContext
    const { state, login, logout, oauthCallback } = flows
    const oauth: OAuth = {
      install: (app: App) => {
        app.provide(oauthKey, oauth)
        app.provide('fetch', oauthFetch)
        app.provide('login', login)
        app.provide('logout', logout)
        app.provide('oauth-callback', oauthCallback)
      },
      dispose: () => {
        scope.stop()
      },
      config: oauthConfig,
      typeConfig: config,
      storageKey,
      ignorePath,
      functions,
      fetch: oauthFetch,
      authHeaders,
      token,
      user,
      state,
      type,
      accessToken,
      status,
      isAuthorized,
      error,
      hasError,
      errorDescription,
      login,
      logout,
      oauthCallback,
      checkToken,
      autoconfigOauth
    }
    return oauth
    // a freshly created detached scope is always active, so run() cannot return undefined here
  }) as OAuth
}

/**
 * Stops the instance installed in `app`.
 *
 * `createOAuth` opens a **detached** effect scope, so the watchers it holds — the
 * refresh watcher, the user watchers, the storage sync — are owned by no component
 * and nothing stops them for you. On the client that is what you want: one instance,
 * alive as long as the page.
 *
 * Under SSR it is the opposite. One instance per request keeps requests isolated, and
 * a render that never disposes leaks that request's watchers and its token graph for
 * the lifetime of the process. Call this in a `finally`, so a render that throws still
 * cleans up:
 *
 * ```ts
 * try {
 *   return await renderToString(app)
 * } finally {
 *   disposeOAuth(app)
 * }
 * ```
 *
 * This is the only reason to reach an instance through an app rather than holding what
 * `createOAuth()` returned, which is why it exists as a named operation.
 */
export const disposeOAuth = (app: App) => {
  app.runWithContext(() => getActiveOAuth()).dispose()
}

export const useOAuthConfig = () => getActiveOAuth().config
export const useOAuthFunctions = () => getActiveOAuth().functions
export const useOAuthToken = () => getActiveOAuth().token
export const useOAuthUser = () => getActiveOAuth().user
export const useOAuthFetch = () => getActiveOAuth().fetch
export const useOAuth = () => {
  const {
    typeConfig,
    storageKey,
    ignorePath,
    type,
    accessToken,
    status,
    isAuthorized,
    error,
    hasError,
    errorDescription,
    state,
    login,
    logout,
    oauthCallback,
    autoconfigOauth,
    checkToken
  } = getActiveOAuth()
  return {
    config: typeConfig,
    storageKey,
    ignorePath,
    type,
    accessToken,
    status,
    isAuthorized,
    error,
    hasError,
    errorDescription,
    state,
    login,
    logout,
    oauthCallback,
    isExpiredToken,
    autoconfigOauth,
    checkToken
  }
}
