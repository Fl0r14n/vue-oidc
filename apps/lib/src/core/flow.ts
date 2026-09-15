import { resolveOAuthFunctions } from './functions'
import { createIdTokenVerifier, type IdTokenVerifier } from './jwt'
import { parseRedirectParameters, type RedirectSource } from './redirect'
import {
  type AuthorizationCodeParameters,
  type AuthorizationHandoff,
  type AuthorizationRequest,
  type OAuthFunctions,
  type OAuthToken,
  OAuthType,
  type OpenIdConfig
} from './types'

export type AuthorizationOptions = {
  functions?: Partial<OAuthFunctions>
  /** reuse a verifier built once for this configuration; one is built per call otherwise */
  verifyIdToken?: IdTokenVerifier
}

const verifierFor = (config?: Partial<OpenIdConfig>, verifyIdToken?: IdTokenVerifier) =>
  verifyIdToken ??
  createIdTokenVerifier({
    jwksUri: (config as OpenIdConfig)?.jwksUri,
    issuer: (config as OpenIdConfig)?.issuer || (config as OpenIdConfig)?.issuerPath,
    audience: config?.clientId
  })

/** RFC 6749 §10.12. Only checked against a state we hold, so a callback arriving without a prior
 * `beginAuthorization` — a deep link, a resumed session — is left to the caller as before. */
const checkState = (parameters: Record<string, string>, handoff?: Partial<AuthorizationHandoff>) => {
  if (!handoff?.state) return undefined
  // some providers drop state from the error response; the error is more useful than a state complaint,
  // and a forged *success* still has to match
  if (parameters.error && !parameters.state) return undefined
  return parameters.state === handoff.state ? undefined : { error: 'Invalid state' }
}

const checkNonce = async (token: OAuthToken, handoff: Partial<AuthorizationHandoff> | undefined, verify: IdTokenVerifier) => {
  if (token.error) return token
  const claims = await verify(token.id_token)
  if (claims?.error || claims?.nonce !== handoff?.nonce) {
    return { error: (claims?.error as string) || 'Invalid nonce' }
  }
  return token
}

/** Starts an authorization request without performing it: returns the URL to send the user to and the
 * handoff to keep until they come back. Nothing here touches storage, `location` or a Vue ref, so it is
 * as usable from a request handler as from a browser. */
export const beginAuthorization = async (
  config: Partial<OpenIdConfig> | undefined,
  parameters: AuthorizationCodeParameters,
  { functions }: Pick<AuthorizationOptions, 'functions'> = {}
): Promise<AuthorizationRequest> => resolveOAuthFunctions(functions).authorizationUrl(parameters, config)

/** Finishes one: classifies the redirect, checks state, exchanges the code and checks the nonce. The
 * handoff is passed back in rather than looked up, which is what makes it safe to run concurrently. */
export const completeAuthorization = async (
  config: Partial<OpenIdConfig> | undefined,
  currentUrl: RedirectSource | undefined,
  handoff?: Partial<AuthorizationHandoff>,
  { functions, verifyIdToken }: AuthorizationOptions = {}
): Promise<OAuthToken | undefined> => {
  const { flow, parameters } = parseRedirectParameters(currentUrl)
  if (flow === 'none') return undefined

  const invalidState = checkState(parameters, handoff)
  if (invalidState) return invalidState

  const verify = verifierFor(config, verifyIdToken)
  if (flow === 'implicit') {
    return { ...(await checkNonce(parameters, handoff, verify)), type: OAuthType.IMPLICIT }
  }

  // the handoff carries redirect_uri and code_verifier, the redirect carries the code — the token
  // endpoint needs both, and the type is set by `authorize`, so it stays unset here
  const requested = { ...handoff, ...parameters }
  const exchanged = await resolveOAuthFunctions(functions).authorize(requested, config)
  return (exchanged && (await checkNonce(exchanged, handoff, verify))) || requested
}
