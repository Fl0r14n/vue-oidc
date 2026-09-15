import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { createDiscovery } from './core/discovery'
import { createOAuth, registerOAuthCleanup } from './test-utils'

registerOAuthCleanup()

const wellKnown = { authorization_endpoint: 'https://auth.com/a', token_endpoint: 'https://auth.com/t' }

const config = { issuerPath: 'https://auth.com', clientId: 'c1' }

describe('autoconfigOauth', () => {
  let openIdConfiguration: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    openIdConfiguration = jest.fn().mockResolvedValue(wellKnown)
  })

  it('stays lazy — creating an instance fetches nothing', async () => {
    createOAuth({ config, functions: { openIdConfiguration } })
    await Promise.resolve()

    expect(openIdConfiguration).not.toHaveBeenCalled()
  })

  it('collapses concurrent lookups into one request', async () => {
    const oauth = createOAuth({ config, functions: { openIdConfiguration, clientCredentialLogin: jest.fn() } })

    // both see an unconfigured endpoint, and today both would fetch
    await Promise.all([oauth.autoconfigOauth(), oauth.autoconfigOauth(), oauth.autoconfigOauth()])

    expect(openIdConfiguration).toHaveBeenCalledTimes(1)
    expect(oauth.typeConfig.value).toMatchObject({ tokenPath: 'https://auth.com/t' })
  })

  it('does not look again once the endpoints are known', async () => {
    const oauth = createOAuth({ config, functions: { openIdConfiguration } })

    await oauth.autoconfigOauth()
    await oauth.autoconfigOauth()

    expect(openIdConfiguration).toHaveBeenCalledTimes(1)
  })

  it('never looks when the endpoints were configured statically', async () => {
    const oauth = createOAuth({ config: { ...config, tokenPath: '/t' }, functions: { openIdConfiguration } })

    await oauth.autoconfigOauth()

    expect(openIdConfiguration).not.toHaveBeenCalled()
  })

  it('shares one resolver across per-request instances, which is the point of passing your own', async () => {
    const discovery = createDiscovery({ functions: { openIdConfiguration } })

    for (let request = 0; request < 3; request++) {
      await createOAuth({ config, discovery, functions: { openIdConfiguration } }).autoconfigOauth()
    }

    expect(openIdConfiguration).toHaveBeenCalledTimes(1)
  })

  // 46f1f1c: the refresh path was the one entry point that did not discover, so an app booting with an
  // expired token in storage refreshed against a config with no tokenPath, fell through the
  // `refresh_token && tokenPath` guard in `refresh`, and never recovered the session
  it('discovers before refreshing an expired token, so a restored session can recover', async () => {
    const refresh = jest.fn().mockResolvedValue({ access_token: 'fresh', expires_in: 60 })
    const oauth = createOAuth({ config, functions: { openIdConfiguration, refresh } })

    // what `storageRef` hands back on a boot with a session already in storage
    oauth.token.value = { access_token: 'stale', token_type: 'Bearer', refresh_token: 'r1', expires: Date.now() - 10_000 }
    await oauth.checkToken()

    expect(openIdConfiguration).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tokenPath: 'https://auth.com/t' }))
    expect(oauth.token.value.access_token).toBe('fresh')
  })

  // eager discovery, without an unawaited fetch inside createOAuth: warming the resolver is the caller's
  // call, so a server does it once at start and a render that never touches auth still fetches nothing
  it('serves a flow from a resolver warmed before the instance existed', async () => {
    const discovery = createDiscovery({ functions: { openIdConfiguration } })
    await discovery(config)

    const oauth = createOAuth({ config, discovery, functions: { openIdConfiguration } })
    await oauth.autoconfigOauth()

    expect(openIdConfiguration).toHaveBeenCalledTimes(1)
    expect(oauth.typeConfig.value).toMatchObject({ tokenPath: 'https://auth.com/t' })
  })

  it('keeps instances apart when it builds its own', async () => {
    await createOAuth({ config, functions: { openIdConfiguration } }).autoconfigOauth()
    await createOAuth({ config, functions: { openIdConfiguration } }).autoconfigOauth()

    expect(openIdConfiguration).toHaveBeenCalledTimes(2)
  })
})
