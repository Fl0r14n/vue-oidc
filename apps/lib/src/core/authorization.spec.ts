import { describe, expect, it } from 'bun:test'
import { authorizationUrl } from './authorization'

const config = {
  authorizePath: 'https://auth.com/authorize',
  clientId: 'client123',
  scope: 'openid profile',
  pkce: true
}

const parameters = { redirectUri: 'https://app.com/cb', responseType: 'code' }

const query = (url: string) => new URL(url).searchParams

describe('authorizationUrl', () => {
  it('builds the standard request', async () => {
    const { url } = await authorizationUrl(parameters, config)

    const params = query(url)
    expect(url.startsWith('https://auth.com/authorize?client_id=client123')).toBe(true)
    expect(params.get('redirect_uri')).toBe('https://app.com/cb')
    expect(params.get('response_type')).toBe('code')
    expect(params.get('scope')).toBe('openid profile')
  })

  it('returns the handoff instead of storing it, and puts nothing else in it', async () => {
    const { handoff } = await authorizationUrl(parameters, config)

    expect(Object.keys(handoff).sort()).toEqual(['code_verifier', 'nonce', 'redirect_uri', 'state'])
    expect(handoff.redirect_uri).toBe('https://app.com/cb')
  })

  it('generates a state when none is given, and keeps the given one', async () => {
    const generated = await authorizationUrl(parameters, config)
    expect(generated.handoff.state).toBeTruthy()
    expect(query(generated.url).get('state')).toBe(generated.handoff.state as string)

    const supplied = await authorizationUrl({ ...parameters, state: 'mine' }, config)
    expect(supplied.handoff.state).toBe('mine')
    expect(query(supplied.url).get('state')).toBe('mine')
  })

  it('never issues the same state or nonce twice', async () => {
    const [one, two] = await Promise.all([authorizationUrl(parameters, config), authorizationUrl(parameters, config)])

    expect(one.handoff.state).not.toBe(two.handoff.state)
    expect(one.handoff.nonce).not.toBe(two.handoff.nonce)
    expect(one.handoff.code_verifier).not.toBe(two.handoff.code_verifier)
  })

  it('sends the challenge but keeps the verifier in the handoff', async () => {
    const { url, handoff } = await authorizationUrl(parameters, config)

    expect(query(url).get('code_challenge')).toBeTruthy()
    expect(query(url).get('code_challenge_method')).toBe('S256')
    expect(url).not.toContain(handoff.code_verifier as string)
  })

  it('skips pkce when it is not configured', async () => {
    const { url, handoff } = await authorizationUrl(parameters, { ...config, pkce: false })

    expect(handoff.code_verifier).toBeUndefined()
    expect(query(url).get('code_challenge')).toBeNull()
  })

  it('asks for a nonce only when the scope is openid', async () => {
    const openid = await authorizationUrl(parameters, config)
    expect(openid.handoff.nonce).toBeTruthy()
    expect(query(openid.url).get('nonce')).toBe(openid.handoff.nonce as string)

    const plain = await authorizationUrl(parameters, { ...config, scope: 'profile' })
    expect(plain.handoff.nonce).toBeUndefined()
    expect(query(plain.url).get('nonce')).toBeNull()
  })

  it('sends prompt on its own, without access_type having to be set', async () => {
    const { url } = await authorizationUrl({ ...parameters, prompt: 'select_account' }, config)

    expect(query(url).get('prompt')).toBe('select_account')
    expect(query(url).get('access_type')).toBeNull()
  })

  it('omits an empty prompt rather than sending the parameter blank', async () => {
    const { url } = await authorizationUrl({ ...parameters, accessType: 'offline' }, config)

    expect(query(url).get('access_type')).toBe('offline')
    expect(query(url).has('prompt')).toBe(false)
  })

  it('merges extras last, so a provider parameter reaches the endpoint without an override', async () => {
    const { url } = await authorizationUrl(
      { ...parameters, extras: { ui_locales: 'de-DE', audience: 'https://api.example', ignored: undefined } },
      config
    )

    const params = query(url)
    expect(params.get('ui_locales')).toBe('de-DE')
    expect(params.get('audience')).toBe('https://api.example')
    expect(params.has('ignored')).toBe(false)
  })

  it('appends to an authorize path that already carries a query', async () => {
    const { url } = await authorizationUrl(parameters, { ...config, authorizePath: 'https://auth.com/authorize?tenant=k2' })

    expect(query(url).get('tenant')).toBe('k2')
    expect(query(url).get('client_id')).toBe('client123')
  })
})
