import { createRemoteJWKSet, jwtVerify } from 'jose'

export type IdTokenClaims = Record<string, any>

export type IdTokenVerifier = (idToken?: string) => Promise<IdTokenClaims>

export type IdTokenVerifierOptions = {
  jwksUri?: string
  issuer?: string
  audience?: string
  /** off decodes without checking the signature — only for a provider that publishes no JWKS */
  strict?: boolean
}

/** Decodes without verifying anything. The claims are the provider's word, unchecked — read them only
 * after `createIdTokenVerifier` has passed the token, or for a value nothing is decided on. */
export const parseIdToken = (idToken?: string): IdTokenClaims => {
  const payload = idToken?.split('.')[1]
  if (!payload) return {}
  // JWT segments are base64url (RFC 7515) — atob only accepts base64: map -_ back and re-pad
  const base64 = payload
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=')
  return JSON.parse(
    decodeURIComponent(
      Array.from(atob(base64))
        .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    )
  )
}

/** Holds the remote JWKS for its lifetime, so build one per configuration and keep it — jose caches keys
 * on the set, and a fresh one per verification refetches them. */
export const createIdTokenVerifier = ({ jwksUri, issuer, audience, strict = true }: IdTokenVerifierOptions): IdTokenVerifier => {
  const jwksSet = jwksUri && strict ? createRemoteJWKSet(new URL(jwksUri)) : undefined
  return async idToken => {
    if (!idToken) return {}
    if (!jwksSet) return parseIdToken(idToken)
    try {
      const { payload } = await jwtVerify(idToken, jwksSet, {
        ...(issuer && { issuer }),
        ...(audience && { audience })
      })
      return payload
    } catch {
      return { error: 'Invalid token' }
    }
  }
}
