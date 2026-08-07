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
- **Tests**: `bun test` using `bun:test`. One spec per module (`config`, `token`, `flows`, `fetch`,
  `functions`, `user`, `module`, `ref`, `axios/index`)
- **Exports**: `vue-oidc` (main), `vue-oidc/axios` (optional axios adapter) and `vue-oidc/component`
- **Peer deps**: `vue^3` (required), `axios^1`, `vuetify^3`, `@mdi/js` (all optional)
- **Runtime deps**: `jose`

### Build entries

Three separate builds, each with its own externals:

- `index` — the library. Transport is `fetch`; **nothing in its graph may import axios**, or the optional
  peer becomes required for every consumer.
- `axios` — the optional adapter (`src/axios/index.ts`). The **only** file that may import axios.
- `component` — the optional vuetify UI. Keeps vuetify/`@mdi` out of an app that only wants composables.

The two optional entries import the root **by package name** (`from 'vue-oidc'`), never relatively, so the
bundler keeps it external and there is one copy of the active-instance pointer at runtime. A relative
import across an entry boundary silently inlines a second copy and every composable in that entry answers
with an instance nobody installed. `tsconfig.json` maps `vue-oidc` → `src/index.ts` via `paths` so
`bun test` and type-checking resolve source instead of a possibly-stale `dist/`; `deps.neverBundle` still
externalizes it in the bundle, and `verify-entries.ts` asserts the import survived.

### Architecture (v5, instance-based, fetch transport)

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
