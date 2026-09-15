import type { App, ComputedRef, Ref, WritableComputedRef } from 'vue'
import type {
  Discovery,
  OAuthFetch,
  OAuthFunctions,
  OAuthParameters,
  OAuthStatus,
  OAuthToken,
  OAuthType,
  OAuthTypeConfig,
  UserInfo
} from './core/types'

export type OAuthConfig<TExtra = unknown> = {
  config?: Partial<OAuthTypeConfig>
  storageKey?: string
  ignorePaths?: RegExp[]
  strictJwt?: boolean
  functions?: Partial<OAuthFunctions>
  /** share one across per-request instances to fetch each issuer's well-known document once; omitted,
   * the instance gets its own, which still collapses concurrent lookups into a single request */
  discovery?: Discovery
} & TExtra

export interface OAuth {
  install: (app: App) => void
  /** stops this instance's watchers — call it when a server render ends */
  dispose: () => void
  config: Ref<OAuthConfig>
  /** the provider/endpoint part of the config (`config.value.config`) */
  typeConfig: WritableComputedRef<Partial<OAuthTypeConfig> | undefined>
  storageKey: WritableComputedRef<string>
  /** register a path the authorization interceptor must skip — idempotent; read the registered
   * patterns via `config.value.ignorePaths` */
  ignorePath: (pattern: RegExp) => void
  functions: OAuthFunctions
  fetch: OAuthFetch
  authHeaders: (url?: string) => Promise<Record<string, string>>
  token: Ref<OAuthToken>
  user: Ref<UserInfo | undefined>
  state: Ref<string | undefined>
  type: ComputedRef<OAuthType | undefined>
  accessToken: ComputedRef<string | undefined>
  status: ComputedRef<OAuthStatus>
  isAuthorized: ComputedRef<boolean>
  error: ComputedRef<string | undefined>
  hasError: ComputedRef<boolean>
  errorDescription: ComputedRef<string | undefined>
  login: (parameters?: OAuthParameters) => Promise<string | undefined>
  logout: (logoutRedirectUri?: string, state?: string) => Promise<void>
  oauthCallback: (url?: string | URL) => Promise<void>
  checkToken: () => Promise<void>
  autoconfigOauth: () => Promise<void>
}
