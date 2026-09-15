import { describe, expect, it } from 'bun:test'
import { calculatePKCECodeChallenge, randomNonce, randomPKCECodeVerifier, randomState, randomString } from './random'

const BASE64URL = /^[A-Za-z0-9\-_]+$/

describe('random', () => {
  it('produces the requested length from the base64url alphabet', () => {
    const value = randomString(48)

    expect(value).toHaveLength(48)
    expect(value).toMatch(BASE64URL)
  })

  it('does not repeat itself', () => {
    const values = new Set(Array.from({ length: 50 }, () => randomString()))

    expect(values.size).toBe(50)
  })

  it('gives state, nonce and verifier the same shape', () => {
    for (const value of [randomState(), randomNonce(), randomPKCECodeVerifier()]) {
      // RFC 7636 §4.1 puts the verifier between 43 and 128 unreserved characters
      expect(value.length).toBeGreaterThanOrEqual(43)
      expect(value.length).toBeLessThanOrEqual(128)
      expect(value).toMatch(BASE64URL)
    }
  })

  it('challenges the verifier as unpadded base64url, and stably', async () => {
    const verifier = randomPKCECodeVerifier()
    const challenge = await calculatePKCECodeChallenge(verifier)

    expect(challenge).toMatch(BASE64URL)
    expect(challenge).not.toContain('=')
    expect(await calculatePKCECodeChallenge(verifier)).toBe(challenge)
  })

  it('challenges different verifiers differently', async () => {
    expect(await calculatePKCECodeChallenge('one')).not.toBe(await calculatePKCECodeChallenge('two'))
  })
})
