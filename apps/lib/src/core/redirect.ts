export type RedirectFlow = 'implicit' | 'code' | 'none'

export type RedirectSource = string | URL | { hash?: string; search?: string }

export type ParsedRedirect = {
  flow: RedirectFlow
  parameters: Record<string, string>
}

const parts = (source?: RedirectSource) => {
  if (!source) return {}
  if (typeof source === 'string') return new URL(source)
  return source
}

const parseOauthUri = (fragment?: string) => {
  const params = Object.fromEntries(new URLSearchParams(fragment?.replace(/^[#?]/, '')))
  return (Object.keys(params).length && params) || {}
}

/** Classifies a redirect back from the authorization endpoint and parses its parameters. An `error=` in
 * either place is still that flow's response — RFC 6749 §4.1.2.1 returns it on the redirect uri. */
export const parseRedirectParameters = (source?: RedirectSource): ParsedRedirect => {
  const { hash, search } = parts(source)
  if (hash && /(access_token=)|(error=)/.test(hash)) {
    return { flow: 'implicit', parameters: parseOauthUri(hash) }
  }
  if ((search && /(code=)|(error=)/.test(search)) || (hash && /(code=)|(error=)/.test(hash))) {
    return { flow: 'code', parameters: parseOauthUri(search || hash) }
  }
  return { flow: 'none', parameters: {} }
}
