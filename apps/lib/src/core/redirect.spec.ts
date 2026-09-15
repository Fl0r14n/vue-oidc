import { describe, expect, it } from 'bun:test'
import { parseRedirectParameters } from './redirect'

describe('parseRedirectParameters', () => {
  it('reads an implicit response off the hash', () => {
    const { flow, parameters } = parseRedirectParameters('https://app.com/cb#access_token=at&token_type=Bearer&state=s1')

    expect(flow).toBe('implicit')
    expect(parameters).toEqual({ access_token: 'at', token_type: 'Bearer', state: 's1' })
  })

  it('reads a code response off the query', () => {
    const { flow, parameters } = parseRedirectParameters('https://app.com/cb?code=c1&state=s2')

    expect(flow).toBe('code')
    expect(parameters).toEqual({ code: 'c1', state: 's2' })
  })

  it('reads a code response off the hash, for a provider that puts it there', () => {
    const { flow, parameters } = parseRedirectParameters('https://app.com/cb#code=c1')

    expect(flow).toBe('code')
    expect(parameters.code).toBe('c1')
  })

  it('treats an error as the response it belongs to — RFC 6749 §4.1.2.1 returns it on the redirect uri', () => {
    expect(parseRedirectParameters('https://app.com/cb?error=access_denied').flow).toBe('code')
    expect(parseRedirectParameters('https://app.com/cb#error=access_denied').flow).toBe('implicit')
  })

  it('classifies anything else as none', () => {
    expect(parseRedirectParameters('https://app.com/cb').flow).toBe('none')
    expect(parseRedirectParameters('https://app.com/cb?returnUrl=/checkout').flow).toBe('none')
    expect(parseRedirectParameters(undefined).flow).toBe('none')
  })

  it('accepts a URL and a location-shaped object, not only a string', () => {
    expect(parseRedirectParameters(new URL('https://app.com/cb?code=c1')).parameters.code).toBe('c1')
    expect(parseRedirectParameters({ search: '?code=c1', hash: '' }).parameters.code).toBe('c1')
  })
})
