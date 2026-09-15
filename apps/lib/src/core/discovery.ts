import { resolveOAuthFunctions } from './functions'
import type { Discovery, OAuthFunctions, OpenIdConfig, OpenIdConfiguration } from './types'

/** Endpoints already configured statically win — discovery is the fallback, not the source of truth. */
export const needsDiscovery = (config?: Partial<OpenIdConfig>) => {
  const { tokenPath, authorizePath } = (config || {}) as OpenIdConfig
  return !(tokenPath || authorizePath)
}

/** The well-known document mapped onto the config's own names. Absent members leave the config's value
 * alone, so a static override survives a later discovery. */
export const applyDiscovery = (config: Partial<OpenIdConfig> | undefined, discovered?: OpenIdConfiguration) => {
  const c = (config || {}) as OpenIdConfig
  if (!discovered) return c
  return {
    ...c,
    ...(discovered.issuer && { issuer: discovered.issuer }),
    ...(discovered.authorization_endpoint && { authorizePath: discovered.authorization_endpoint }),
    ...(discovered.token_endpoint && { tokenPath: discovered.token_endpoint }),
    ...(discovered.revocation_endpoint && { revokePath: discovered.revocation_endpoint }),
    ...(discovered.userinfo_endpoint && { userPath: discovered.userinfo_endpoint }),
    ...(discovered.introspection_endpoint && { introspectionPath: discovered.introspection_endpoint }),
    ...(discovered.end_session_endpoint && { logoutPath: discovered.end_session_endpoint }),
    ...(discovered.jwks_uri && { jwksUri: discovered.jwks_uri }),
    ...(c?.pkce === undefined &&
      discovered.code_challenge_methods_supported && { pkce: discovered.code_challenge_methods_supported.indexOf('S256') > -1 }),
    scope: c?.scope || 'openid'
  }
}

/** An issuer-keyed lookup, so a process serving many requests fetches each well-known document once.
 * A failed lookup is not cached — a transient outage would otherwise stick for the process lifetime. */
export const createDiscovery = ({ functions }: { functions?: Partial<OAuthFunctions> } = {}): Discovery => {
  const cache = new Map<string, Promise<OpenIdConfiguration | undefined>>()
  return async (config?: Partial<OpenIdConfig>) => {
    const key = `${(config as OpenIdConfig)?.issuerPath}|${config?.clientId || ''}`
    let discovered = cache.get(key)
    if (!discovered) {
      discovered = resolveOAuthFunctions(functions).openIdConfiguration(config)
      cache.set(key, discovered)
    }
    const result = await discovered.catch(() => undefined)
    if (!result) {
      cache.delete(key)
    }
    return result
  }
}
