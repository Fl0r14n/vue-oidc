const arrToString = (buf: Uint8Array) => buf.reduce((s, b) => s + String.fromCharCode(b), '')

const base64url = (str: string) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

export const randomString = (length: number = 48) => {
  const buff = arrToString(crypto.getRandomValues(new Uint8Array(length * 2)))
  return base64url(buff).substring(0, length)
}

export const randomState = () => randomString()

export const randomNonce = () => randomString()

/** RFC 7636 §4.1 — 43..128 characters of the unreserved set, which `randomString`'s base64url alphabet is */
export const randomPKCECodeVerifier = () => randomString()

export const calculatePKCECodeChallenge = async (verifier: string) => {
  const buff = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(arrToString(new Uint8Array(buff)))
}
