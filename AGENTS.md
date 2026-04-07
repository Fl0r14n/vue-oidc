# AGENTS.md

## Workspace

Bun monorepo (`workspaces: ["apps/*"]`). Two packages:
- **`apps/lib`** (`vue-oidc`) — OAuth 2.1 Vue library, published as npm package
- **`apps/app`** (`vue-oidc-client`) — demo/consumer app that links `vue-oidc` via `workspace:*`

## Commands

Run from repo root. Always use `bun`, never `npm`/`yarn`/`pnpm`.

```
bun install            # install all workspace deps
bun run dev            # start dev servers for all workspaces
bun run build          # build lib (tsdown) + app (Bun.build)
bun run test           # run lib tests (only lib has tests)
bun run lint           # biome lint .
bun run format         # biome format --write .
bun run check          # biome check --write . (lint + format)
```

Per-package:
```
bun --filter vue-oidc build     # build lib only
bun --filter vue-oidc test      # run lib tests
bun --filter vue-oidc-client dev  # start app dev server (port 3001)
```

## Library (`apps/lib`)

- **Build**: `tsdown` → ESM output to `dist/`, generates `.d.mts` types
- **Tests**: `bun test` using `bun:test`. Only `oauth.spec.ts` and `ref.spec.ts`
- **Exports**: `vue-oidc` (main) and `vue-oidc/component` (raw `OAuth.vue` source)
- **Peer deps**: `vue^3` (required), `vuetify^3`, `@mdi/js`, `sass` (all optional)
- **Runtime dep**: `axios` (never bundled per tsdown config)

## App (`apps/app`)

- **Dev**: `bun --hot index.html` — Bun's native hot-reload, no Vite
- **SSR**: `SSR=true bun --preload ./vue-plugin.ts server.ts` — Bun.serve on port 3001
- **Build**: `bun build.ts` — uses `Bun.build` API directly, outputs to `dist/`
- **Vue plugin**: `@eckidevs/bun-plugin-vue` (NOT `bun-plugin-vue`), requires `{ optionsApi: true }`
- **Stack**: Vue 3, Vue Router, Pinia, Vuetify

## Biome config

- 2-space indent, single quotes, no semicolons, no trailing commas
- `lineWidth: 140`, `bracketSameLine: true`
- `noExplicitAny` rule is **off**
- `.vue` files: `noUnusedVariables` and `noUnusedImports` are **off**
- Ignores `**/index.html`

## Env vars

Root `.env` / `.env.production` drive OAuth config:
- `OAUTH_ISSUER_PATH`, `OAUTH_CLIENT_ID`, `OAUTH_SCOPE`, `OAUTH_TYPE`, `OAUTH_STATE`, `APP_DOMAIN`
- App also uses `API_BASE`, `API_PATH`, `API_INSTANCE` (production)
- `THEME=light` default

## Test quirks

- Tests mock modules via `mock.module()` from `bun:test`
- `crypto` and `location` globals are manually mocked in `oauth.spec.ts`
- Only the library has tests; the app has none
