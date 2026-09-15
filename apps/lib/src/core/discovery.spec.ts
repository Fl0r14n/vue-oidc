import { describe, expect, it, jest } from 'bun:test'
import { applyDiscovery, createDiscovery, needsDiscovery } from './discovery'

const wellKnown = {
  authorization_endpoint: 'https://auth.com/a',
  token_endpoint: 'https://auth.com/t',
  revocation_endpoint: 'https://auth.com/r',
  userinfo_endpoint: 'https://auth.com/u',
  introspection_endpoint: 'https://auth.com/i',
  end_session_endpoint: 'https://auth.com/logout',
  jwks_uri: 'https://auth.com/jwks',
  code_challenge_methods_supported: ['S256']
}

describe('needsDiscovery', () => {
  it('is what an already configured endpoint answers no to', () => {
    expect(needsDiscovery({ issuerPath: 'https://auth.com' } as any)).toBe(true)
    expect(needsDiscovery({ tokenPath: 'https://auth.com/t' } as any)).toBe(false)
    expect(needsDiscovery({ authorizePath: 'https://auth.com/a' } as any)).toBe(false)
    expect(needsDiscovery(undefined)).toBe(true)
  })
})

describe('applyDiscovery', () => {
  it('maps the well-known document onto the config names', () => {
    expect(applyDiscovery({ issuerPath: 'https://auth.com' } as any, wellKnown)).toMatchObject({
      authorizePath: 'https://auth.com/a',
      tokenPath: 'https://auth.com/t',
      revokePath: 'https://auth.com/r',
      userPath: 'https://auth.com/u',
      introspectionPath: 'https://auth.com/i',
      logoutPath: 'https://auth.com/logout',
      jwksUri: 'https://auth.com/jwks',
      pkce: true,
      scope: 'openid'
    })
  })

  it('records the issuer the provider asserts, which is not always where the document lives', () => {
    const entra = { ...wellKnown, issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0' }

    const applied = applyDiscovery({ issuerPath: 'https://login.microsoftonline.com/common/v2.0' } as any, entra)

    expect(applied.issuer).toBe('https://login.microsoftonline.com/{tenantid}/v2.0')
    // the discovery endpoint is not rewritten — a later lookup still has somewhere to go
    expect(applied.issuerPath).toBe('https://login.microsoftonline.com/common/v2.0')
  })

  it('leaves a value the document does not carry alone', () => {
    const applied = applyDiscovery({ userPath: 'https://mine/me' } as any, { token_endpoint: 'https://auth.com/t' })

    expect(applied.userPath).toBe('https://mine/me')
  })

  it('does not overrule an explicit pkce choice, or an explicit scope', () => {
    expect(applyDiscovery({ pkce: false, scope: 'openid email' } as any, wellKnown)).toMatchObject({ pkce: false, scope: 'openid email' })
  })

  it('returns the config untouched when there is nothing to apply', () => {
    const config = { issuerPath: 'https://auth.com' } as any

    expect(applyDiscovery(config, undefined)).toBe(config)
  })
})

describe('createDiscovery', () => {
  it('fetches each issuer once', async () => {
    const openIdConfiguration = jest.fn().mockResolvedValue(wellKnown)
    const discover = createDiscovery({ functions: { openIdConfiguration } })
    const config = { issuerPath: 'https://auth.com', clientId: 'c1' } as any

    await Promise.all([discover(config), discover(config), discover(config)])

    expect(openIdConfiguration).toHaveBeenCalledTimes(1)
  })

  it('keeps issuers apart', async () => {
    const openIdConfiguration = jest.fn().mockResolvedValue(wellKnown)
    const discover = createDiscovery({ functions: { openIdConfiguration } })

    await discover({ issuerPath: 'https://google', clientId: 'c1' } as any)
    await discover({ issuerPath: 'https://microsoft', clientId: 'c1' } as any)

    expect(openIdConfiguration).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure — an outage must not outlive itself', async () => {
    const openIdConfiguration = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(wellKnown)
    const discover = createDiscovery({ functions: { openIdConfiguration } })
    const config = { issuerPath: 'https://auth.com' } as any

    expect(await discover(config)).toBeUndefined()
    expect(await discover(config)).toEqual(wellKnown)
    expect(openIdConfiguration).toHaveBeenCalledTimes(2)
  })

  it('survives a rejected lookup', async () => {
    const openIdConfiguration = jest.fn().mockRejectedValue(new Error('offline'))
    const discover = createDiscovery({ functions: { openIdConfiguration } })

    expect(await discover({ issuerPath: 'https://auth.com' } as any)).toBeUndefined()
  })
})
