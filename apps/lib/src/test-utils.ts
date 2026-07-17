import { afterEach } from 'bun:test'
import { createOAuth as create } from './module'
import type { OAuth, OAuthConfig } from './types'

// Specs must dispose what they create: the alive-instance count drives the server-side ambiguity
// detection in getActiveOAuth, and bun runs every spec file in one process — leaked instances from
// one file would trip the ambiguity error in another. This tracked factory disposes automatically.
const live: OAuth[] = []

// call at the top of every spec file that uses the tracked factory — this module is cached, so a
// module-level afterEach would register in the first importing file only
export const registerOAuthCleanup = () =>
  afterEach(() => {
    live.splice(0).forEach(instance => {
      instance.dispose()
    })
  })

export const createOAuth = (cfg?: OAuthConfig): OAuth => {
  const instance = create(cfg)
  live.push(instance)
  return instance
}
