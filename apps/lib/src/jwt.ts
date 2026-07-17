import { createRemoteJWKSet, jwtVerify } from 'jose'
import { watch } from 'vue'
import type { ConfigContext } from './config'
import type { OpenIdConfig } from './types'

const parseJwt = (idToken?: string) => {
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

export const createJwt = ({ config, strictJwt }: Pick<ConfigContext, 'config' | 'strictJwt'>) => {
  let jwksSet: ReturnType<typeof createRemoteJWKSet> | undefined

  watch(
    [() => (config.value as OpenIdConfig)?.jwksUri, strictJwt],
    ([jwksUri, strict]) => {
      jwksSet = jwksUri && strict ? createRemoteJWKSet(new URL(jwksUri)) : undefined
    },
    { immediate: true }
  )

  return async (idToken?: string) => {
    if (!idToken) return {}
    if (!jwksSet) return parseJwt(idToken)
    const { issuerPath, clientId } = (config.value as OpenIdConfig) || {}
    try {
      const { payload } = await jwtVerify(idToken, jwksSet, {
        ...(issuerPath && { issuer: issuerPath }),
        ...(clientId && { audience: clientId })
      })
      return payload
    } catch {
      return { error: 'Invalid token' }
    }
  }
}

export type Jwt = ReturnType<typeof createJwt>
