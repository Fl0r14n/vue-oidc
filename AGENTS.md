# AGENTS.md

## Workspace

Bun monorepo (`workspaces: ["apps/*"]`). Two packages:
- **`apps/lib`** (`vue-oidc`) — OAuth 2.1 Vue library, published as npm package
- **`apps/app`** (`vue-oidc-client`) — demo/consumer app that links `vue-oidc` via `workspace:*`

## Commands

Run from repo root. Always use `bun`, never `npm`/`yarn`/`pnpm`.

```
bun install            # install all workspace deps
bun run dev            # start dev servers for all workspaces (app on port 3000)
bun run ssr            # start SSR dev server (Vite middleware + Bun.serve)
bun run build          # build lib (tsdown) + app (vite build)
bun run test           # run lib tests (only lib has tests)
bun run lint           # biome lint .
bun run format         # biome format --write .
bun run check          # biome check --write . (lint + format)
```

Per-package:
```
bun --filter vue-oidc build     # build lib only
bun --filter vue-oidc test      # run lib tests
bun --filter vue-oidc-client dev  # start app dev server (Vite, port 3000)
```

## Dependencies

Deps are declared as `latest` and bumped with `bun update --latest --filter '*'`. One exception:
`typescript` is pinned to `^6` in both packages. TypeScript 7 (the Go compiler) is on the `latest`
npm tag, but `vue-tsc` still requires `typescript/lib/tsc` and `rolldown-plugin-dts` crashes in
`createVueLanguage` against it. Unpin only after both support TS 7.

## Library (`apps/lib`)

- **Build**: `tsdown` → ESM output to `dist/`, generates `.d.mts` types. `bun run build` also runs
  `verify-entries.ts`, which asserts the entry invariants below against the built output
- **Tests**: `bun test` using `bun:test`. One spec per module (`config`, `token`, `flows`, `fetch`, `jwt`,
  `user`, `module`, `ref`, `axios/index`, and `core/{authorization,discovery,flow,functions,random,redirect}`).
  Core specs need no effect scope and no DOM — if a new test does, the behaviour probably belongs in core
- **Exports**: `vue-oidc` (main), `vue-oidc/core` (the protocol, no vue), `vue-oidc/axios` (optional axios
  adapter) and `vue-oidc/component`
- **Peer deps**: `vue^3` (required), `axios^1`, `vuetify^3`, `@mdi/js` (all optional)
- **Runtime deps**: `jose`

### Build entries

Four separate builds, each with its own externals:

- `core` — the protocol: authorization URL construction, redirect parsing, the code exchange, id-token
  verification, discovery, and the PKCE/state/nonce primitives. **Nothing in its graph may import vue** —
  that is the entry's whole reason to exist, and `verify-entries.ts` asserts it against the built output.
  It is the bottom of the graph and imports nothing from above it. `jose` is its only runtime dependency.
  It holds no module-level state, which is why the root may bundle a second copy of it harmlessly.
- `index` — the library. Transport is `fetch`; **nothing in its graph may import axios**, or the optional
  peer becomes required for every consumer. It bundles `core` relatively and re-exports it, rather than
  importing `vue-oidc/core` by package name — the root cannot name its own package (see the check below).
- `axios` — the optional adapter (`src/axios/index.ts`). The **only** file that may import axios. It
  composes rather than configures: `createAxiosOAuth()` wraps `createOAuth()` and provides one client per
  instance under `httpKey`. Never add a `createOAuth(cfg, withAxios)`-style flag — that puts an axios
  branch in the core entry and the separate build stops meaning anything. The client is built *with* the
  instance, not cached against it, so there is no registry and no way to reach another request's client.
- `component` — the optional vuetify UI. Keeps vuetify/`@mdi` out of an app that only wants composables.

The two optional entries import the root **by package name** (`from 'vue-oidc'`), never relatively, so the
bundler keeps it external and there is one copy of the active-instance pointer at runtime. A relative
import across an entry boundary silently inlines a second copy and every composable in that entry answers
with an instance nobody installed. `tsconfig.json` maps `vue-oidc` → `src/index.ts` via `paths` so
`bun test` and type-checking resolve source instead of a possibly-stale `dist/`; `deps.neverBundle` still
externalizes it in the bundle, and `verify-entries.ts` asserts the import survived.

### Architecture (v5, instance-based, fetch transport)

- **Discovery is lazy, and every path that needs an endpoint must await it first.** `autoconfigOauth` runs
  from `login`, `logout`, the code branch of `oauthCallback` and `checkToken`; `needsDiscovery` makes it a
  no-op once the endpoints are known. The fourth was missing until `46f1f1c`: the refresh watcher called
  `functions.refresh` directly, so booting with an expired token in storage refreshed against a config
  whose `tokenPath` had never been discovered, `refresh` fell through its `refresh_token && tokenPath`
  guard, and the session never recovered. `b58c291` added the other half — the startup watcher is
  `[config, accessToken]` with `immediate`, so the initial check waits for a config to exist. Add a call
  site that touches an endpoint and it awaits `autoconfigOauth` too.
- Do not move discovery earlier to make it eager. `createOAuth()` is synchronous and `typeConfig` is
  writable, so the config is not necessarily final when the instance is built, and under SSR an eager
  lookup would put a well-known fetch on every render including the ones that never touch auth. Caching
  belongs in the `Discovery` resolver, not in an earlier call site.
- **`issuerPath` is where the well-known document lives; `issuer` is what the provider asserts in `iss`.**
  They differ only for multi-tenant providers — Entra's `/common` document advertises a `{tenantid}`
  template, resolved per token from the `tid` claim, because no literal issuer exists until a token
  arrives. Discovery fills `issuer` in and never rewrites `issuerPath`, or the next lookup has nowhere to
  go. `core/jwt.spec.ts` signs real tokens against a stubbed JWKS; a verification rule added with a
  stubbed verifier would assert nothing.
- **`src/core/` is pure and `src/*.ts` is the reactive layer over it.** A function that computes something
  from its arguments belongs in core; a function that reads or writes a ref belongs above it. `flows.ts`
  is the adapter between them — it holds the handoff in the token ref, redirects, and delegates the
  protocol to `core/flow.ts`. Reach for core when adding protocol behaviour, so it stays testable without
  an effect scope and usable from a server.
- All state lives on an `OAuth` instance built by `createOAuth()` — no module-level state except the
  active-instance pointer. Each source file exports a factory (`createConfig`, `createToken`, `createFetch`,
  `createFlows`, `createUser`, `createJwt`); `module.ts` composes them inside a detached `effectScope`
  (`dispose()` stops all watchers). Factories bind their dependencies via closures at construction —
  never resolve state through the active pointer inside library internals, that reintroduces the
  cross-request race under SSR.
- Composable resolution (`getActiveOAuth`): `inject(oauthKey)` and nothing else. There is **no**
  module-level active-instance pointer, deliberately — a pointer answers even when ambiguous, and the
  ambiguous answer under concurrent SSR is another request's instance (one user's bearer on another
  user's call). Requiring the context makes an unresolvable call site fail identically everywhere on its
  first run, instead of working on the client and in single-request tests and breaking only under
  production SSR load. Do not reintroduce a pointer.
- `hasInjectionContext`, not `getCurrentInstance`: `inject()` also resolves inside pinia store setups
  (pinia wraps them in `app.runWithContext` itself, so even a lazily created store is fine) and inside
  vue-router navigation guards (`runGuardQueue` wraps each guard). In an async guard or handler the
  context covers the **synchronous** part only — composables must be called before the first `await`.
- SSR: one `createOAuth()` + `app.use()` per request; dispose it when the render ends. Either hold the
  instance `createOAuth()` returned or fetch it with `app.runWithContext(() => getActiveOAuth())`. The
  lib never imports `node:async_hooks`.
- Behavior overrides are constructor input: `createOAuth({ functions: { refresh } })` merges over
  `defaultOAuthFunctions`. Never mutate a shared functions object.

### Test gotcha

bun test provides **no** `localStorage` — a spec that needs storage must install its own
module-load mock (see `ref.spec.ts`/`user.spec.ts`); relying on another file's mock leaking in
makes the test depend on file load order. Mocks are process-shared once installed, so any spec
that creates instances must run `globalThis.localStorage?.clear()` in `beforeEach`.

A spec that replaces `globalThis.fetch` must restore the real one in `afterEach` — the process is shared
across spec files, so a leaked mock breaks whichever file runs next (`fetch.spec.ts`, `functions.spec.ts`).

Specs must also dispose every instance they create: instances hold watchers, and bun runs all spec files
in one process. Use the tracked factory from `test-utils.ts` (`import { createOAuth, registerOAuthCleanup }
from './test-utils'` + `registerOAuthCleanup()` at file top — the helper is module-cached, so the
afterEach must be registered per file).

A spec that calls a **composable** needs an injection context, since there is no pointer to fall back on.
Use `installOAuth()` from `test-utils.ts`: it returns the instance plus a `run(fn)` that supplies the
context the way a component setup or store setup would.

## App (`apps/app`)

- **Dev**: Vite via `bun --filter vue-oidc-client dev` — port 3000, HMR host `vite.local.dev` with WSS
- **SSR**: `bun run ssr` — runs `index.ts` which creates Vite in middleware mode + Bun.serve with TLS
- **Build**: `vite build` via `bun run build`
- **Stack**: Vue 3, Vue Router, Pinia, Vuetify, Vite
- **TLS**: `.cert/key.pem` + `.cert/cert.pem` (optional, dev server uses HTTPS if present)
- **Alias**: `@` maps to `./src`

## Biome config

- 2-space indent, single quotes, no semicolons, no trailing commas
- `lineWidth: 140`, `bracketSameLine: true`
- `noExplicitAny` rule is **off**
- `.vue` files: `noUnusedVariables` and `noUnusedImports` are **off**
- Ignores `**/index.html`

## Env vars

App env vars use `VITE_` prefix (Vite convention):
- `VITE_OAUTH_ISSUER_PATH`, `VITE_OAUTH_CLIENT_ID`, `VITE_OAUTH_SCOPE`, `VITE_OAUTH_TYPE`
- `VITE_API_BASE`, `VITE_API_PATH`, `VITE_API_INSTANCE` (production)
- `VITE_THEME=light` default
- `PORT` overrides default 3000

## Test quirks

- Tests mock modules via `mock.module()` from `bun:test`
- `crypto` and `location` globals are manually mocked in `flows.spec.ts`
- Only the library has tests; the app has vitest configured but no test files
