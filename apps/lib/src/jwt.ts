import { createRemoteJWKSet, jwtVerify } from 'jose'
import { watch } from 'vue'
import { config, strictJwt } from './config'
import type { OpenIdConfig } from './types'

export const jwt = (idToken?: string) => {
  const payload = idToken?.split('.')[1]
  return payload
    ? JSON.parse(
        decodeURIComponent(
          Array.from(atob(payload))
            .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join('')
        )
      )
    : {}
}

let jwksSet: ReturnType<typeof createRemoteJWKSet> | undefined

watch(
  [() => (config.value as OpenIdConfig)?.jwksUri, strictJwt],
  ([jwksUri, strict]) => {
    jwksSet = jwksUri && strict ? createRemoteJWKSet(new URL(jwksUri)) : undefined
  },
  { immediate: true }
)

export const verifyJwt = async (idToken?: string) => {
  if (!idToken) return {}
  if (!jwksSet) return jwt(idToken)
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
