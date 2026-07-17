import { describe, expect, it } from 'bun:test'
import { computed } from 'vue'
import { createJwt } from './jwt'

const base64url = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const makeIdToken = (payload: object) => `${base64url(JSON.stringify({ alg: 'none' }))}.${base64url(JSON.stringify(payload))}.sig`

// no jwksUri + strictJwt off → the local parseJwt path is exercised
const jwt = createJwt({
  config: computed(() => ({})) as any,
  strictJwt: computed(() => false) as any
})

describe('jwt parse (no jwks)', () => {
  it('returns {} without a token', async () => {
    expect(await jwt()).toEqual({})
  })

  it('parses a plain ascii payload', async () => {
    const payload = { sub: 'abc', admin: true }
    expect(await jwt(makeIdToken(payload))).toEqual(payload)
  })

  it('parses base64url payloads containing - and _', async () => {
    const payload = { sub: '1234567890', name: 'ÿÿÿ' } // utf-8 bytes hit the base64url -/_ alphabet
    const idToken = makeIdToken(payload)
    expect(idToken.split('.')[1]).toMatch(/[-_]/) // guard: the regression is actually exercised
    expect(await jwt(idToken)).toEqual(payload)
  })

  it('parses unpadded payload lengths', async () => {
    // vary payload length so the stripped base64 padding must be reconstructed
    for (const name of ['a', 'ab', 'abc', 'abcd']) {
      const payload = { name }
      expect(await jwt(makeIdToken(payload))).toEqual(payload)
    }
  })
})
