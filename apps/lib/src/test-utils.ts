import { afterEach } from 'bun:test'
import { createApp } from 'vue'
import { createOAuth as create } from './module'
import type { OAuth, OAuthConfig } from './types'

// Instances hold watchers, so a spec that leaks one leaks an effect scope for the rest of the process.
// bun runs every spec file in one process, so this tracked factory disposes automatically.
const live: OAuth[] = []

// call at the top of every spec file that uses the tracked factory — this module is cached, so a
// module-level afterEach would register in the first importing file only
export const registerOAuthCleanup = () =>
  afterEach(() => {
    live.splice(0).forEach(instance => {
      instance.dispose()
    })
  })

/** register an instance built elsewhere — e.g. `createAxiosOAuth()`, which core specs cannot import */
export const trackOAuth = <T extends OAuth>(instance: T): T => {
  live.push(instance)
  return instance
}

export const createOAuth = (cfg?: OAuthConfig): OAuth => trackOAuth(create(cfg))

/** An installed instance plus the injection context its composables require — there is no module-level
 * pointer to resolve through, so anything calling `useOAuth*()` has to run inside one. `run` is what a
 * component setup, a pinia store setup or a navigation guard supplies in a real app. */
export const installOAuth = (cfg?: OAuthConfig) => {
  const oauth = createOAuth(cfg)
  const app = createApp({ render: () => null })
  app.use(oauth)
  return { oauth, app, run: <T>(fn: () => T): T => app.runWithContext(fn) }
}
