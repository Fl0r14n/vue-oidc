import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from 'bun:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createIdTokenVerifier, parseIdToken } from './jwt'

const JWKS_URI = 'https://provider.example/jwks'
const CLIENT_ID = 'client123'
const ENTRA = 'https://login.microsoftonline.com/{tenantid}/v2.0'
const TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

const realFetch = globalThis.fetch

let privateKey: CryptoKey
let jwks: { keys: any[] }

// a real signature over a real JWKS, because every check this suite is about happens inside jwtVerify
// or immediately after it — a stubbed verifier would assert nothing
const sign = (claims: Record<string, any>) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuedAt()
    .setExpirationTime(claims.exp ? new Date(Number(claims.exp) * 1000) : '5m')
    .sign(privateKey)

describe('createIdTokenVerifier', () => {
  beforeAll(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true })
    privateKey = pair.privateKey
    jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'ES256', kid: 'k1' }] }
  })

  beforeEach(() => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify(jwks), { headers: { 'Content-Type': 'application/json' } })) as any
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const verifier = (issuer: any) => createIdTokenVerifier({ jwksUri: JWKS_URI, issuer, audience: CLIENT_ID })

  describe('a literal issuer', () => {
    it('accepts a token it signed and issued', async () => {
      const token = await sign({ iss: 'https://provider.example', aud: CLIENT_ID, sub: 'u1' })

      expect(await verifier('https://provider.example')(token)).toMatchObject({ sub: 'u1' })
    })

    it('rejects another issuer, another audience, and an expired token', async () => {
      const verify = verifier('https://provider.example')

      expect(await verify(await sign({ iss: 'https://elsewhere', aud: CLIENT_ID, sub: 'u1' }))).toEqual({ error: 'Invalid token' })
      expect(await verify(await sign({ iss: 'https://provider.example', aud: 'other', sub: 'u1' }))).toEqual({ error: 'Invalid token' })
      expect(
        await verify(await sign({ iss: 'https://provider.example', aud: CLIENT_ID, sub: 'u1', exp: Math.floor(Date.now() / 1000) - 60 }))
      ).toEqual({ error: 'Invalid token' })
    })

    it('accepts any of a set', async () => {
      const verify = verifier(['https://a.example', 'https://provider.example'])

      expect(await verify(await sign({ iss: 'https://provider.example', aud: CLIENT_ID, sub: 'u1' }))).toMatchObject({ sub: 'u1' })
      expect(await verify(await sign({ iss: 'https://b.example', aud: CLIENT_ID, sub: 'u1' }))).toEqual({ error: 'Invalid token' })
    })
  })

  // Entra's /common document advertises no literal issuer, so this is every Microsoft sign-in
  describe('a {tenantid} template', () => {
    it('accepts the tenant the token names', async () => {
      const token = await sign({ iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, tid: TENANT, aud: CLIENT_ID, sub: 'u1' })

      expect(await verifier(ENTRA)(token)).toMatchObject({ sub: 'u1', tid: TENANT })
    })

    it('rejects a tid that does not produce the issuer it claims', async () => {
      const token = await sign({ iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, tid: 'some-other-tenant', aud: CLIENT_ID })

      expect(await verifier(ENTRA)(token)).toEqual({ error: 'Invalid token' })
    })

    it('rejects a token carrying no tid to resolve it with', async () => {
      const token = await sign({ iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, aud: CLIENT_ID })

      expect(await verifier(ENTRA)(token)).toEqual({ error: 'Invalid token' })
    })

    it('rejects the template read literally, which is what it used to do', async () => {
      const token = await sign({ iss: ENTRA, tid: TENANT, aud: CLIENT_ID })

      expect(await verifier(ENTRA)(token)).toEqual({ error: 'Invalid token' })
    })
  })

  describe('an issuer derived from the claims', () => {
    it('accepts what the function returns', async () => {
      const token = await sign({ iss: 'https://t1.provider.example', org: 't1', aud: CLIENT_ID, sub: 'u1' })
      const issuer = (claims: any) => `https://${claims.org}.provider.example`

      expect(await verifier(issuer)(token)).toMatchObject({ sub: 'u1' })
      expect(await verifier(() => undefined)(token)).toEqual({ error: 'Invalid token' })
    })
  })

  // OIDC Core 3.1.3.7
  describe('azp', () => {
    it('is required once the token has more than one audience', async () => {
      const claims = { iss: 'https://provider.example', aud: [CLIENT_ID, 'another'], sub: 'u1' }

      expect(await verifier('https://provider.example')(await sign(claims))).toEqual({ error: 'Invalid token' })
      expect(await verifier('https://provider.example')(await sign({ ...claims, azp: CLIENT_ID }))).toMatchObject({ sub: 'u1' })
    })

    it('must be us when it is present at all', async () => {
      const token = await sign({ iss: 'https://provider.example', aud: CLIENT_ID, azp: 'a-different-client', sub: 'u1' })

      expect(await verifier('https://provider.example')(token)).toEqual({ error: 'Invalid token' })
    })
  })

  it('decodes without checking anything when strict is off', async () => {
    const token = await sign({ iss: 'https://elsewhere', aud: 'not-us', tid: 'x' })

    expect(await createIdTokenVerifier({ jwksUri: JWKS_URI, issuer: ENTRA, audience: CLIENT_ID, strict: false })(token)).toMatchObject({
      iss: 'https://elsewhere'
    })
  })

  it('answers an absent token with no claims rather than an error', async () => {
    expect(await verifier('https://provider.example')(undefined)).toEqual({})
    expect(parseIdToken(undefined)).toEqual({})
  })
})
