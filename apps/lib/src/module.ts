import { type App, effectScope, hasInjectionContext, type InjectionKey, inject } from 'vue'
import { createConfig } from './config'
import { defaultOAuthFunctions } from './functions'
import { createHttp } from './http'
import { createJwt } from './jwt'
import { createFlows } from './oauth'
import { createToken, isExpiredToken } from './token'
import type { OAuth, OAuthConfig } from './types'
import { createUser } from './user'

export const oauthKey: InjectionKey<OAuth> = Symbol('vue-oidc')

// pointer to the last created/installed instance so composables work outside any injection context
// (the same shape as pinia's activePinia / vue-router's install-provided key)
let activeOAuth: OAuth | undefined

// instances alive right now (created and not disposed) — >1 means concurrent apps, where the
// module pointer is ambiguous
let aliveInstances = 0

const pointerFallback = () => {
  // the pointer is only wrong when ambiguous: on the server with several instances alive
  // (concurrent SSR) it could hand out another request's instance — fail loud. On the client
  // the last-installed instance stays the deliberate answer.
  if (activeOAuth && aliveInstances > 1 && typeof window === 'undefined') {
    throw new Error(
      '[vue-oidc]: ambiguous OAuth instance: multiple instances are alive on the server. Resolve inside an injection context (component/store setup, navigation guard, app.runWithContext).'
    )
  }
  return activeOAuth
}

export const getActiveOAuth = (): OAuth => {
  // hasInjectionContext, not getCurrentInstance: inject() also resolves inside pinia store setups
  // and vue-router navigation guards, which run under the app's runWithContext without a component
  // instance — exactly the places a per-request SSR app needs per-app resolution
  const instance = (hasInjectionContext() && inject(oauthKey, undefined)) || pointerFallback()
  if (!instance) {
    throw new Error('[vue-oidc]: no active OAuth instance. Call createOAuth() and install it with app.use() first.')
  }
  return instance
}

export const createOAuth = (cfg?: OAuthConfig): OAuth => {
  const scope = effectScope(true)
  let disposed = false
  aliveInstances++
  const instance = scope.run(() => {
    const configContext = createConfig(cfg)
    const functions = { ...defaultOAuthFunctions, ...cfg?.functions }
    const jwt = createJwt(configContext)
    const tokenContext = createToken(configContext, functions)
    const httpContext = createHttp(configContext, tokenContext)
    const flows = createFlows(configContext, tokenContext, functions, jwt)
    const { user } = createUser(configContext, tokenContext, httpContext, functions, jwt)
    const { oauthConfig, config, ignorePath, storageKey } = configContext
    const { token, type, accessToken, status, isAuthorized, error, hasError, errorDescription, autoconfigOauth, checkToken } = tokenContext
    const { http, authorizationInterceptor, unauthorizedInterceptor } = httpContext
    const { state, login, logout, oauthCallback } = flows
    const oauth: OAuth = {
      install: (app: App) => {
        app.provide(oauthKey, oauth)
        app.provide('http', http)
        app.provide('login', login)
        app.provide('logout', logout)
        app.provide('oauth-callback', oauthCallback)
        activeOAuth = oauth
      },
      dispose: () => {
        if (!disposed) {
          disposed = true
          aliveInstances--
        }
        scope.stop()
        if (activeOAuth === oauth) {
          activeOAuth = undefined
        }
      },
      config: oauthConfig,
      typeConfig: config,
      storageKey,
      ignorePath,
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
  }) as OAuth
  activeOAuth = instance
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
    autoconfigOauth
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
    autoconfigOauth
  }
}
