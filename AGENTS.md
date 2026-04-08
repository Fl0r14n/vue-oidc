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

## Library (`apps/lib`)

- **Build**: `tsdown` → ESM output to `dist/`, generates `.d.mts` types
- **Tests**: `bun test` using `bun:test`. Only `oauth.spec.ts` and `ref.spec.ts`
- **Exports**: `vue-oidc` (main) and `vue-oidc/component` (raw `OAuth.vue` source)
- **Peer deps**: `vue^3` (required), `vuetify^3`, `@mdi/js` (all optional)
- **Runtime deps**: `axios` (never bundled per tsdown config)

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
