/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_THEME?: string
  VITE_API_BASE?: string
  VITE_API_PATH?: string
  VITE_API_INSTANCE?: string
  VITE_OAUTH_ISSUER_PATH?: string
  VITE_OAUTH_AUTHORIZE_PATH?: string
  VITE_OAUTH_TOKEN_PATH?: string
  VITE_OAUTH_LOGOUT_PATH?: string
  VITE_OAUTH_LOGOUT_REDIRECT_URI?: string
  VITE_OAUTH_CLIENT_ID?: string
  VITE_OAUTH_CLIENT_SECRET?: string
  VITE_OAUTH_SCOPE?: string
  VITE_OAUTH_TYPE?: string
  VITE_OAUTH_PKCE?: string
}