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

- **Build**: `tsdown` → ESM output to `dist/`, generates `.d.mts` types
- **Tests**: `bun test` using `bun:test`. One spec per module (`config`, `token`, `oauth`, `http`, `user`, `module`, `ref`)
- **Exports**: `vue-oidc` (main) and `vue-oidc/component` (raw `OAuth.vue` source)
- **Peer deps**: `vue^3` (required), `vuetify^3`, `@mdi/js` (all optional)
- **Runtime deps**: `axios` (never bundled per tsdown config)

### Architecture (v4, instance-based)

- All state lives on an `OAuth` instance built by `createOAuth()` — no module-level state except the
  active-instance pointer. Each source file exports a factory (`createConfig`, `createToken`, `createHttp`,
  `createFlows`, `createUser`, `createJwt`); `module.ts` composes them inside a detached `effectScope`
  (`dispose()` stops all watchers). Factories bind their dependencies via closures at construction —
  never resolve state through the active pointer inside library internals, that reintroduces the
  cross-request race under SSR.
- Composable resolution order (`getActiveOAuth`): `inject(oauthKey)` whenever an injection context
  exists (`hasInjectionContext` — component setup, pinia store setup, vue-router navigation guards,
  anything under `app.runWithContext`) → module pointer (set by `createOAuth` and `install`, the
  same shape as pinia's `activePinia`). The pointer only serves calls outside any injection
  context; on the server it **throws** when hit while multiple instances are alive — a
  concurrent-SSR answer from a global pointer could belong to another request, so ambiguity fails
  loud instead of guessing. On the client the last-installed instance stays the answer.
- SSR: one `createOAuth()` + `app.use()` per request; dispose it when the render ends
  (`app.runWithContext(() => getActiveOAuth()).dispose()`). Injection-context resolution covers
  guards and store setups — no per-request resolver mechanism exists or is needed. The lib never
  imports `node:async_hooks`.
- Behavior overrides are constructor input: `createOAuth({ functions: { refresh } })` merges over
  `defaultOAuthFunctions`. Never mutate a shared functions object.

### Test gotcha

bun test provides **no** `localStorage` — a spec that needs storage must install its own
module-load mock (see `ref.spec.ts`/`user.spec.ts`); relying on another file's mock leaking in
makes the test depend on file load order. Mocks are process-shared once installed, so any spec
that creates instances must run `globalThis.localStorage?.clear()` in `beforeEach`.

Specs must also dispose every instance they create: bun runs all spec files in one process and the
alive-instance count drives the server-side ambiguity error in `getActiveOAuth`. Use the tracked
factory from `test-utils.ts` (`import { createOAuth, registerOAuthCleanup } from './test-utils'` +
`registerOAuthCleanup()` at file top — the helper is module-cached, so the afterEach must be
registered per file).

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
- `crypto` and `location` globals are manually mocked in `oauth.spec.ts`
- Only the library has tests; the app has vitest configured but no test files
