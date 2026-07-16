import { type App, effectScope, getCurrentInstance, type InjectionKey, inject } from 'vue'
import { createConfig } from './config'
import { defaultOAuthFunctions } from './functions'
import { createHttp } from './http'
import { createJwt } from './jwt'
import { createFlows } from './oauth'
import { createToken, isExpiredToken } from './token'
import type { OAuthConfig, OAuthInstance } from './types'
import { createUser } from './user'

export const oauthKey: InjectionKey<OAuthInstance> = Symbol('vue-oidc')

// pointer to the last created/installed instance so composables work outside setup (guards, stores)
let activeOAuth: OAuthInstance | undefined
export const setActiveOAuth = (instance?: OAuthInstance) => (activeOAuth = instance)

// SSR servers with a per-request context (e.g. AsyncLocalStorage) resolve the request's instance here,
// so concurrent renders can't read each other's instance
let resolveOAuth: (() => OAuthInstance | undefined) | undefined
export const setOAuthResolver = (resolver?: () => OAuthInstance | undefined) => (resolveOAuth = resolver)

export const getActiveOAuth = (): OAuthInstance => {
  const instance = (getCurrentInstance() && inject(oauthKey, undefined)) || resolveOAuth?.() || activeOAuth
  if (!instance) {
    throw new Error('[vue-oidc]: no active OAuth instance. Call createOAuth() and install it with app.use() first.')
  }
  return instance
}

export const createOAuth = (cfg?: OAuthConfig): OAuthInstance => {
  const scope = effectScope(true)
  const instance = scope.run(() => {
    const configContext = createConfig(cfg)
    const functions = { ...defaultOAuthFunctions, ...cfg?.functions }
    const jwt = createJwt(configContext)
    const tokenContext = createToken(configContext, functions)
    const httpContext = createHttp(configContext, tokenContext)
    const flows = createFlows(configContext, tokenContext, functions, jwt)
    const { user } = createUser(configContext, tokenContext, httpContext, functions, jwt)
    const { oauthConfig, config, ignoredPaths, storageKey } = configContext
    const { token, type, accessToken, status, isAuthorized, error, hasError, errorDescription, autoconfigOauth, checkToken } = tokenContext
    const { http, authorizationInterceptor, unauthorizedInterceptor } = httpContext
    const { state, login, logout, oauthCallback } = flows
    const oauth: OAuthInstance = {
      install: (app: App) => {
        app.provide(oauthKey, oauth)
        app.provide('http', http)
        app.provide('login', login)
        app.provide('logout', logout)
        app.provide('oauth-callback', oauthCallback)
        setActiveOAuth(oauth)
      },
      dispose: () => {
        scope.stop()
        if (activeOAuth === oauth) {
          setActiveOAuth(undefined)
        }
      },
      config: oauthConfig,
      typeConfig: config,
      storageKey,
      ignoredPaths,
      functions,
      http,
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
      autoconfigOauth,
      authorizationInterceptor,
      unauthorizedInterceptor
    }
    return oauth
  }) as OAuthInstance
  setActiveOAuth(instance)
  return instance
}

export const useOAuthConfig = () => getActiveOAuth().config
export const useOAuthFunctions = () => getActiveOAuth().functions
export const useOAuthToken = () => getActiveOAuth().token
export const useOAuthUser = () => getActiveOAuth().user
export const useOAuthHttp = () => getActiveOAuth().http
export const useOAuthInterceptors = () => {
  const { authorizationInterceptor, unauthorizedInterceptor } = getActiveOAuth()
  return {
    authorizationInterceptor,
    unauthorizedInterceptor
  }
}
export const useOAuth = () => {
  const {
    typeConfig,
    storageKey,
    ignoredPaths,
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
    autoconfigOauth
  } = getActiveOAuth()
  return {
    config: typeConfig,
    storageKey,
    ignoredPaths,
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
    autoconfigOauth
  }
}
