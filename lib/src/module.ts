import { accessToken, error, errorDescription, hasError, isAuthorized, isExpiredToken, status, token, type } from '@/token'
import { authorizationInterceptor, http, unauthorizedInterceptor, user } from '@/user'
import type { App } from 'vue'
import { config, ignoredPaths, oauthConfig, storageKey } from './config'
import { oauthFunctions } from './functions'
import type { OAuth, OAuthConfig } from './models'
import { login, logout, oauthCallback } from './oauth'

export const createOAuth = (cfg?: OAuthConfig) => {
  oauthConfig.value = {
    ...oauthConfig.value,
    ...cfg
  }
  return {
    install: (app: App) => {
      app.provide('http', http)
      app.provide('login', login)
      app.provide('logout', logout)
      app.provide('oauth-callback', oauthCallback)
    },
    config: oauthConfig,
    functions: oauthFunctions
  } as OAuth
}

export const useOAuthConfig = () => oauthConfig
export const useOAuthFunctions = () => oauthFunctions
export const useOAuthToken = () => token
export const useOAuthUser = () => user
export const useOAuthHttp = () => http
export const useOAuthInterceptors = () => ({
  authorizationInterceptor,
  unauthorizedInterceptor
})
export const useOAuth = () => ({
  config,
  storageKey,
  ignoredPaths,
  type,
  accessToken,
  status,
  isAuthorized,
  error,
  hasError,
  errorDescription,
  login,
  logout,
  isExpiredToken,
  oauthCallback
})
