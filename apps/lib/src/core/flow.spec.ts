import { describe, expect, it, jest } from 'bun:test'
import { beginAuthorization, completeAuthorization } from './flow'
import type { IdTokenVerifier } from './jwt'
import { OAuthType } from './types'

const config = { authorizePath: 'https://auth.com/authorize', tokenPath: 'https://auth.com/token', clientId: 'client123', scope: 'openid' }

const parameters = { redirectUri: 'https://app.com/cb', responseType: 'code' }

const claims =
  (payload: Record<string, any>): IdTokenVerifier =>
  async () =>
    payload

describe('beginAuthorization', () => {
  it('returns the url and the handoff, and performs nothing', async () => {
    const { url, handoff } = await beginAuthorization(config, parameters)

    expect(url).toContain('https://auth.com/authorize?')
    expect(handoff.state).toBeTruthy()
  })

  it('routes through an overridden authorizationUrl', async () => {
    const authorizationUrl = jest.fn().mockResolvedValue({ url: 'https://elsewhere', handoff: { redirect_uri: 'x' } })

    const request = await beginAuthorization(config, parameters, { functions: { authorizationUrl } })

    expect(authorizationUrl).toHaveBeenCalledWith(parameters, config)
    expect(request.url).toBe('https://elsewhere')
  })
})

describe('completeAuthorization', () => {
  it('ignores a url that is not a redirect back', async () => {
    expect(await completeAuthorization(config, 'https://app.com/cb', { state: 's' })).toBeUndefined()
  })

  it('exchanges the code with the handoff the request was started with', async () => {
    const authorize = jest.fn().mockResolvedValue({ access_token: 'at', type: OAuthType.AUTHORIZATION_CODE })
    const handoff = { redirect_uri: 'https://app.com/cb', state: 's1', code_verifier: 'v1' }

    const token = await completeAuthorization(config, 'https://app.com/cb?code=c1&state=s1', handoff, {
      functions: { authorize },
      verifyIdToken: claims({})
    })

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'c1', code_verifier: 'v1', redirect_uri: 'https://app.com/cb' }),
      config
    )
    expect(token).toMatchObject({ access_token: 'at' })
  })

  it('refuses a state that is not the one it issued', async () => {
    const authorize = jest.fn()

    const token = await completeAuthorization(
      config,
      'https://app.com/cb?code=c1&state=forged',
      { state: 's1' },
      { functions: { authorize } }
    )

    expect(token).toEqual({ error: 'Invalid state' })
    // the point of checking first: a forged callback must not burn a code at the token endpoint
    expect(authorize).not.toHaveBeenCalled()
  })

  it('leaves the check alone when it issued no state', async () => {
    const authorize = jest.fn().mockResolvedValue({ access_token: 'at' })

    const token = await completeAuthorization(
      config,
      'https://app.com/cb?code=c1&state=s9',
      {},
      {
        functions: { authorize },
        verifyIdToken: claims({})
      }
    )

    expect(token).toMatchObject({ access_token: 'at' })
  })

  it('passes an error response through when the provider dropped the state from it', async () => {
    const token = await completeAuthorization(
      config,
      'https://app.com/cb?error=access_denied',
      { state: 's1' },
      {
        functions: { authorize: async t => t }
      }
    )

    expect(token).toMatchObject({ error: 'access_denied' })
  })

  it('still refuses a forged error that carries the wrong state', async () => {
    const token = await completeAuthorization(config, 'https://app.com/cb?error=access_denied&state=forged', { state: 's1' })

    expect(token).toEqual({ error: 'Invalid state' })
  })

  it('checks the nonce against the handoff on the implicit response', async () => {
    const source = 'https://app.com/cb#access_token=at&id_token=header.payload.sig'

    const ok = await completeAuthorization(config, source, { nonce: 'n1' }, { verifyIdToken: claims({ nonce: 'n1' }) })
    expect(ok).toMatchObject({ access_token: 'at', type: OAuthType.IMPLICIT })

    const bad = await completeAuthorization(config, source, { nonce: 'n1' }, { verifyIdToken: claims({ nonce: 'other' }) })
    expect(bad).toMatchObject({ error: 'Invalid nonce', type: OAuthType.IMPLICIT })
  })

  it('reports a rejected id token rather than the nonce it could not read', async () => {
    const token = await completeAuthorization(
      config,
      'https://app.com/cb#access_token=at&id_token=h.p.s',
      { nonce: 'n1' },
      {
        verifyIdToken: claims({ error: 'Invalid token' })
      }
    )

    expect(token).toMatchObject({ error: 'Invalid token' })
  })

  it('keeps what the redirect carried when the exchange yields nothing', async () => {
    const token = await completeAuthorization(
      config,
      'https://app.com/cb?code=c1',
      { redirect_uri: 'https://app.com/cb' },
      {
        functions: { authorize: async () => undefined }
      }
    )

    expect(token).toMatchObject({ code: 'c1', redirect_uri: 'https://app.com/cb' })
  })

  it('keeps two callbacks apart — the handoff is an argument, not a lookup', async () => {
    const authorize = jest.fn(async (token: any) => ({ access_token: `at-${token.code_verifier}` }))
    const verifyIdToken = claims({})

    const [one, two] = await Promise.all([
      completeAuthorization(
        config,
        'https://app.com/cb?code=c1&state=s1',
        { state: 's1', code_verifier: 'v1' },
        {
          functions: { authorize },
          verifyIdToken
        }
      ),
      completeAuthorization(
        config,
        'https://app.com/cb?code=c2&state=s2',
        { state: 's2', code_verifier: 'v2' },
        {
          functions: { authorize },
          verifyIdToken
        }
      )
    ])

    expect(one).toMatchObject({ access_token: 'at-v1' })
    expect(two).toMatchObject({ access_token: 'at-v2' })
  })
})
