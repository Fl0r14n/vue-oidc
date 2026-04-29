# vue-oidc

OAuth 2.1 / OpenID Connect Vue 3 library, published as `vue-oidc` on npm.

This repo is a Bun monorepo with two packages:

- **`apps/lib`** — the [`vue-oidc`](apps/lib/README.md) library source. Built with `tsdown`, published to npm.
- **`apps/app`** — `vue-oidc-client`, a demo consumer app linking the lib via `workspace:*`.

## Stack

- Vue 3, Vue Router, Pinia, Vuetify (app)
- Vite + optional Bun SSR (`Bun.serve` + Vite middleware)
- `tsdown` for the library bundle (ESM, `.d.mts` types)
- `bun:test` for library tests, `biome` for lint/format

## Setup

Requires [Bun](https://bun.sh). Never use `npm`/`yarn`/`pnpm`.

```sh
bun install
```

## Run

All commands from repo root.

```sh
bun run dev           # start dev servers for all workspaces (app on port 3000)
bun run ssr           # SSR dev server (Vite middleware + Bun.serve, requires .cert/)
bun run build         # build lib (tsdown) + app (vite build)
bun run test          # run lib tests
bun run lint          # biome lint
bun run format        # biome format --write
bun run check         # biome check --write (lint + format)
```

Per-package:

```sh
bun --filter vue-oidc build           # build lib only
bun --filter vue-oidc test            # lib tests only
bun --filter vue-oidc-client dev      # app dev server only
```

## App env vars

`VITE_`-prefixed (Vite convention):

- `VITE_OAUTH_ISSUER_PATH`, `VITE_OAUTH_CLIENT_ID`, `VITE_OAUTH_SCOPE`, `VITE_OAUTH_TYPE`, `VITE_OAUTH_STATE`
- `VITE_APP_DOMAIN` (defaults to `globalThis.location?.origin`)
- `VITE_API_BASE`, `VITE_API_PATH`, `VITE_API_INSTANCE`
- `VITE_THEME` (default `light`)
- `PORT` overrides default 3000

## TLS for SSR

Place `key.pem` + `cert.pem` in `.cert/`. Dev SSR server uses HTTPS when present. See [.cert/README.md](.cert/README.md).

## Library docs

See [`apps/lib/README.md`](apps/lib/README.md) for usage, configuration, and IdP examples (Keycloak, Azure, Google).

## Publishing

```sh
bun run publish       # builds lib and publishes vue-oidc to npm
```

## License

MIT
