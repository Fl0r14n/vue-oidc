import { watch } from 'vue'
import type { ConfigContext } from './config'
import { createIdTokenVerifier, type IdTokenVerifier } from './core/jwt'
import type { OpenIdConfig } from './core/types'

/** The verifier holds a remote JWKS, so it is rebuilt only when one of the values behind it changes —
 * watching the whole config would refetch the keys every time discovery fills in an unrelated endpoint. */
export const createJwt = ({ config, strictJwt }: Pick<ConfigContext, 'config' | 'strictJwt'>) => {
  let verify: IdTokenVerifier

  watch(
    [
      () => (config.value as OpenIdConfig)?.jwksUri,
      () => (config.value as OpenIdConfig)?.issuer || (config.value as OpenIdConfig)?.issuerPath,
      () => config.value?.clientId,
      strictJwt
    ],
    ([jwksUri, issuer, audience, strict]) => {
      verify = createIdTokenVerifier({ jwksUri, issuer, audience, strict })
    },
    { immediate: true }
  )

  return (idToken?: string) => verify(idToken)
}

export type Jwt = ReturnType<typeof createJwt>
