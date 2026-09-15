## Vue OAuth

> `vue-oidc` is a fully **OAuth 2.1** compliant vue library. The library supports all the 4 flows:
> * **resource**
> * **implicit**
> * **authorization code**
> * **client credentials**

> Supports OIDC

> `PKCE` support for authorization code with code verification

### How to

#### Configure your oauth client

```typescript
import { createOAuth } from 'vue-oidc'

const oauth = createOAuth({
  config: {
    issuerPath: 'https://accounts.google.com',
    clientId: '<your_client_id>'
  }
})
app = createApp(App)
app.use(oauth)
```

* for oauth Authorization flow, add the oauth_callback to router

```typescript
router.addRoute({
  path: '/oauth_callback',
  name: 'oauthCallback',
  // a real (empty) component — a `() => null` lazy loader crashes the router's component
  // resolution when the route actually renders (e.g. an SSR pass)
  component: { render: () => null },
  beforeEnter: oauthCallbackGuard
})
```

where `oauthCallbackGuard` can be something like this:

```typescript
import type { NavigationGuardWithThis, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useOAuth } from 'vue-oidc'

export const oauthCallbackGuard: NavigationGuardWithThis<undefined> = async (to: RouteLocationNormalized) => {
  const appId = 'app'
  const { oauthCallback } = useOAuth()
  await oauthCallback(`${appId}:${to.fullPath}`)
  const { returnUrl } = to.query
  return ((returnUrl && { path: returnUrl }) || { name: 'main', params: to.params }) as RouteLocationRaw
}
```

#### Use oauth store

```typescript
const oauth = useOAuth()
```

* other miscellaneous stores: `useOAuthConfig()`, `useOAuthToken()`, `useOAuthUser()` and `useOAuthFetch()`

The composables resolve the current `OAuth` instance through `inject(oauthKey)`, so they must be called
inside an **injection context**: a component setup, a pinia store setup, a vue-router navigation guard, or
`app.runWithContext()`. There is no module-level "active instance" to fall back on — see
[SSR](#ssr) for why. Outside a context, hold the instance `createOAuth()` returned; it exposes everything
the composables do (`token`, `user`, `status`, `login`, `checkToken`, `fetch`, ...).

In an `async` guard or handler the context covers the **synchronous** part only, so resolve before the
first `await`:

```typescript
const { oauthCallback, state } = useOAuth()   // ✓ resolved first
await oauthCallback(url)
// const { login } = useOAuth()               // ✗ context is gone here — throws
```

#### Authorized requests

The transport is `fetch`. `oauth.fetch` attaches the bearer, refreshes it first when it is expired, and
records a 401's body as the new token state so a session the IdP invalidated behind your back surfaces as
an error instead of a token that looks fine and fails every call:

```typescript
import { useOAuthFetch } from 'vue-oidc'

const oauthFetch = useOAuthFetch()
const orders = await oauthFetch('/api/orders').then(r => r.json())
```

`Accept: application/json` is set on every request, and a **string** body is labelled
`application/json` — typed bodies (`FormData`, `Blob`, `URLSearchParams`, ...) keep the Content-Type the
platform gives them. Paths registered with `oauth.ignorePath(/pattern/)` are sent without a bearer and
never touch the session.

Only the bearer is needed for the raw header — `oauth.authHeaders(url)` returns `{ Authorization }` (or
`{}`), which is what the axios adapter is built on.

#### axios (Optional)

axios is an **optional** peer dependency, imported by the `vue-oidc/axios` entry only — the library
itself has no HTTP client in its graph. Install it if you want it:

```sh
bun i axios --save
```

Build the instance with `createAxiosOAuth` instead of `createOAuth` — same config, plus one axios client
for the instance:

```typescript
import { createAxiosOAuth } from 'vue-oidc/axios'

const oauth = createAxiosOAuth({ config: { issuerPath: '...', clientId: '...' } }, { baseURL: '/api' })
app.use(oauth)

oauth.http // the client, also provided to the app
```

Anywhere in the app, resolve it like any other composable:

```typescript
import { useOAuthHttp } from 'vue-oidc/axios'

const http = useOAuthHttp()
const { data } = await http.get('/orders')
```

There is exactly **one client per instance**, built alongside it, so interceptors you add in a store are
seen by every other call site:

```typescript
// somewhere at setup — adds a header to every authorized request in the app
useOAuthHttp().interceptors.request.use(req => {
  req.params = req.params || new URLSearchParams()
  req.params.append('lang', 'en')
  return req
})
```

One per instance rather than per module because a module-level singleton would let two concurrent SSR
renders cross interceptors — and one *built with* the instance rather than cached against it, so there is
no registry to consult and no way to reach another request's client. `createAxiosOAuth` is also the only
place `defaults` can be honoured unambiguously: a client shared by many call sites cannot let whichever
ran first decide its configuration.

`useOAuthHttp()` throws if the instance was built with plain `createOAuth()` — inventing a client there
would hand back one silently missing whatever interceptors the app attached to the real one.

Already have an app-wide axios client — your own baseURL, timeout, retry logic? Authorize it with the
interceptor pair instead. Attach **both**: the bearer without the 401 branch means a session the IdP
invalidated behind your back is never noticed.

```typescript
import axios from 'axios'
import { axiosInterceptors } from 'vue-oidc/axios'

const oauth = createOAuth({ config: {...} })            // plain instance — no client of its own
const { authorizationInterceptor, unauthorizedInterceptor } = axiosInterceptors(oauth)
const http = axios.create({ baseURL: '/api', timeout: 10_000 })
http.interceptors.request.use(authorizationInterceptor)
http.interceptors.response.use(r => r, unauthorizedInterceptor)
```

`createAxiosClient(oauth, defaults?)` is the shorthand when you want a ready-made authorized client rather
than to bring your own — a second one alongside `oauth.http`, say, for a different baseURL. Both take the
instance explicitly, so neither needs an injection context.

Build **one client per `OAuth` instance**, never a shared module-level default: on the server two
concurrent requests sharing interceptors would mean one request's bearer on another request's call.

The whole entry is four functions — `createAxiosOAuth` (wired), `useOAuthHttp` (resolve it),
`createAxiosClient` (another one), `axiosInterceptors` (bring your own) — plus `httpKey` and the
`AxiosOAuth` type. Only `useOAuthHttp` needs an injection context; the `create*` prefix marks the ones
that build something stateful from what you hand them.

#### Extra authorization parameters

Anything the standard set does not cover — `ui_locales`, `login_hint`, `acr_values`, Auth0's `audience`,
Entra's `resource` — goes through `extras`, merged last, without overriding anything:

```typescript
await login({
  redirectUri: `${location.origin}/oauth_callback`,
  responseType: 'code',
  prompt: 'select_account',
  extras: { ui_locales: 'de-DE', login_hint: 'me@example.com' }
})
```

`state` is generated when you do not supply one, and the callback refuses a redirect whose state is not
the one the request was started with (RFC 6749 §10.12). Supply your own `state` if you use it to carry
application state across the round trip — it is checked the same way.

#### Override oauth functions (Optional)

Every network call (`refresh`, `revoke`, `authorize`, `userInfo`, ...) and the construction of the
authorization URL (`authorizationUrl`) can be replaced per instance — no mutation of shared objects:

```typescript
import { createOAuth, defaultOAuthFunctions } from 'vue-oidc'

const oauth = createOAuth({
  config: {...},
  functions: {
    refresh: async (token, config) => {
      const result = await defaultOAuthFunctions.refresh(token, config)
      // custom handling
      return result
    }
  }
})
```

#### `vue-oidc/core` — the protocol without vue

The flow is separable from the reactivity that drives it in a browser: `vue-oidc/core` is the protocol
by itself, with **no vue in its graph** (only `jose`), so it runs in a request handler, a worker or a
test. Two functions, and nothing implicit between them:

```typescript
import { beginAuthorization, completeAuthorization } from 'vue-oidc/core'

// starts nothing and stores nothing — you decide where the handoff lives
const { url, handoff } = await beginAuthorization(config, {
  redirectUri: 'https://app.example/callback',
  responseType: 'code'
})

// ...later, on the request that comes back, with that same handoff
const token = await completeAuthorization(config, request.url, handoff)
```

The handoff (`state`, `nonce`, `code_verifier`, `redirect_uri`) is passed back in rather than looked up,
which is what makes a confidential client safe to run concurrently: a browser keeps it in storage, a
server keeps it in a cookie or its own store, and neither can reach another user's. The same entry also
publishes the primitives — `randomState`, `randomNonce`, `randomPKCECodeVerifier`,
`calculatePKCECodeChallenge`, `parseRedirectParameters`, `createIdTokenVerifier`, `applyDiscovery` and
`createDiscovery` (the issuer-keyed cache described under *Discovery*) — plus
`defaultOAuthFunctions` and every protocol type. All of it is re-exported from the root, so a browser
app needs no second import.

#### Verifying the id token

`strictJwt` is on by default: the id token's signature is checked against the provider's JWKS, along with
`iss`, `aud`, `exp` and the `nonce` the request was started with. `azp` is checked too — required once the
token carries more than one audience, and required to be you whenever it is present (OIDC Core 3.1.3.7).

**Multi-tenant providers.** Entra's `/common` discovery document does not advertise an issuer; it
advertises a template, because the tenant is not known until the token arrives:

```
https://login.microsoftonline.com/{tenantid}/v2.0
```

Discovery records it as `issuer` (distinct from `issuerPath`, which is where the document lives), and the
verifier resolves it per token from the `tid` claim before comparing. Nothing to configure. For any other
shape of derived issuer, `createIdTokenVerifier` takes a function:

```typescript
createIdTokenVerifier({ jwksUri, audience, issuer: claims => `https://${claims.org}.provider.example` })
```

**Reading the claims.** `completeAuthorization` verifies the id token but returns the token, not the
claims. Hold your own verifier and call it again — the JWKS is cached on the verifier, so a second call is
a signature check and no network:

```typescript
const verifyIdToken = createIdTokenVerifier({ jwksUri, issuer, audience })

const token = await completeAuthorization(config, request.url, handoff, { verifyIdToken })
const claims = await verifyIdToken(token?.id_token)
```

#### Discovery

Endpoints are resolved from the issuer's well-known document the first time a flow needs one — a login, a
logout, a callback or a token refresh — not at `createOAuth()`. Endpoints you configure statically win and
suppress the lookup entirely.

Each instance gets its own resolver, which collapses concurrent lookups into a single request. A server
rendering many requests wants one resolver *across* instances, so each issuer is fetched once per process
rather than once per render:

```typescript
import { createDiscovery, createOAuth } from 'vue-oidc'

const discovery = createDiscovery() // once, at server start

// per request
const oauth = createOAuth({ config: {...}, discovery })
```

A failed lookup is not cached, so an issuer that was briefly unreachable is retried rather than remembered.

Want the fetch to start at bootstrap rather than at the first flow? Warm the resolver — the instance then
finds it already resolved. `createOAuth()` deliberately does not do this for you: it is synchronous, so it
would have to leave an unawaited fetch behind, and under SSR it would fetch on every render including the
ones that never touch auth.

```typescript
const discovery = createDiscovery()
discovery(config) // no await — the first flow awaits it

const oauth = createOAuth({ config, discovery })
```

#### SSR

Create and install **one instance per request** — instances are fully isolated (token, config, watchers).
`dispose()` stops an instance's watchers when the render is done.

Composables resolve the instance through Vue's injection context (`app.use(oauth)` provides it):
component setup, pinia store setups and vue-router navigation guards all run inside the app's context, so
they always answer with the *request's* instance. Pinia wraps store setups in `app.runWithContext` itself,
so even a lazily created store resolves correctly.

Outside any injection context, resolution **throws** rather than falling back to a module-level pointer.
That is deliberate: a pointer answers even when the answer is ambiguous, and under concurrent SSR the
ambiguous answer is another request's instance — one user's bearer on another user's call. Throwing means
an unresolvable call site fails identically everywhere and on its first run, instead of working on the
client and in single-request tests and going wrong only under production load.

```typescript
// entry-server.ts — per request:
const oauth = createOAuth({ config: {...} })
app.use(oauth)
try {
  return await renderToString(app)
} finally {
  disposeOAuth(app)
}
```

`disposeOAuth(app)` stops the watchers `createOAuth` opened in its detached effect scope — nothing else
will, so a render that skips it leaks that request's watchers and token graph for the lifetime of the
process. In a `finally`, so a render that throws still cleans up. If your factory hands the instance back
rather than discarding it, `oauth.dispose()` is the same thing without the lookup.

`oauthCallback()` no-ops on the server: the `code_verifier` lives in the browser's storage, and a
server-side exchange without it would still burn the single-use authorization code at the IDP —
the client's own exchange would then fail with `invalid_grant`. Callback guards need no SSR check.

The library itself never imports `node:async_hooks` — it stays runtime-agnostic.

#### Migrating from v5

Three behaviour changes, all of them narrow:

* **`state` is generated and verified.** `login()` sends a state whether or not you supply one, and
  `oauthCallback` rejects a redirect whose state is not the one it issued, with `{ error: 'Invalid state' }`
  (RFC 6749 §10.12). A provider that does not echo `state` back on the success response will now fail where
  it previously passed. A provider that drops `state` only from its *error* response is tolerated — the
  error reaches you unchanged.
* **`prompt` is sent on its own.** It previously required `accessType` to be set, and was sent blank when
  `accessType` was set without it. Now it is sent when you pass it and omitted when you do not.
* **`OAuthFunctions` gained `authorizationUrl`.** `functions` in the config is `Partial<OAuthFunctions>`, so
  overrides are unaffected. Only code that builds a complete `OAuthFunctions` object needs the new member —
  spread `defaultOAuthFunctions` into it.

Everything else is additive: the `vue-oidc/core` entry, `extras` on the authorization request, the
optional `discovery` resolver, and (6.1) the `azp` check and multi-tenant issuer resolution. No export was
removed.

#### Migrating from v4

axios is no longer required. The protocol is six form-encoded POSTs and two GETs, which needs no client
library — making one a required peer taxed every consumer, including the ones who never touched it. The
library now runs on `fetch`, so it also works where axios is awkward: a worker, a route handler, a plain
service.

* A `createOAuth()` instance no longer has `oauth.http` — it has `oauth.fetch` (`OAuthFetch`, the standard
  `fetch` signature) plus `oauth.authHeaders(url)` for the raw `Authorization` header. `oauth.http` comes
  back if you build with `createAxiosOAuth()` instead (next bullet).
* `useOAuthHttp()` → `useOAuthFetch()`, **or** keep axios: `bun add axios`, build the instance with
  `createAxiosOAuth()` instead of `createOAuth()`, and change the import to
  `import { useOAuthHttp } from 'vue-oidc/axios'`. Same semantics as v4 — one client per instance, so
  interceptors attached at one call site stay visible at every other.
* `inject('http')` keeps working when the instance comes from `createAxiosOAuth()` — it provides the client
  under both `httpKey` and the plain `'http'` key v4 used.
* `useOAuthInterceptors()` is gone, along with `oauth.authorizationInterceptor` /
  `oauth.unauthorizedInterceptor` on the instance. Use `axiosInterceptors(oauth)` from `vue-oidc/axios`,
  which returns both — it takes the instance explicitly, so it needs no injection context.
* `inject('http')` → `inject('fetch')` on a plain `createOAuth()` instance (see the axios note above to
  keep `'http'`).
* **Composables now require an injection context.** v4 fell back to a module-level pointer (the last
  created/installed instance) when there was none. That pointer is gone: `useOAuth()` and friends throw
  outside a component/store setup, navigation guard or `app.runWithContext()`. Move such calls into a
  setup, resolve before the first `await`, or hold the instance `createOAuth()` returned.
* `getActiveOAuth()` still exists, with the same rule — it resolves the context's instance or throws.
* `functions.userInfo(config, instance?: AxiosInstance)` → `functions.userInfo(config, request?: OAuthFetch)`.
  A custom `userInfo` override must call `request(url, init)` and read `response.json()` itself.
* Custom `functions` overrides that returned axios responses now return parsed bodies — same as before,
  but you own the parsing. Errors must **not** throw: an RFC 6749 §5.2 error body *is* the payload and has
  to reach the token, and `revoke` runs during logout where a throw would strand the local session.
* Stored tokens are compatible — same default `storageKey`, same format.

#### Migrating from v3

* State moved from module scope onto the instance: multiple isolated instances are now possible and
  SSR-safe. The composable API (`useOAuth()`, `useOAuthToken()`, ...) is unchanged.
* Overriding behavior by mutating `useOAuthFunctions()` → pass `functions` to `createOAuth()` instead.
* the instance type is `OAuth` (v4's `OAuthInstance` name is gone).
* New exports: `oauthKey`, `defaultOAuthFunctions`, `isExpiredToken`, `getActiveOAuth`.
* v4's `setOAuthResolver`/`setActiveOAuth` are gone — injection-context resolution covers guards and
  store setups, and ambiguous server-side pointer reads throw instead of guessing.
* the `ignoredPaths` computed is gone: register interceptor exclusions with the idempotent
  `ignorePath(pattern)`, read them via `config.value.ignorePaths`.
* `login()` resolves to the authorization url for the authorization-code flow — an SSR host can
  302 to it; on the client the navigation already happened.
* Stored tokens are compatible — same default `storageKey`, same format.

#### Use Oauth functions (Optional)

```typescript
import { inject } from 'vue'

const login = inject('login') //oauth login function
const logout = inject('logout') //oauth logout function
const fetch = inject('fetch') //authorized fetch which will append the authorization token
const oauthCallback = inject('oauth-callback') // if you want to call this from vue component not guard
```

#### OAuth component

OAuth component is provided to quickly bootstrap oauth functionality

```typescript
import OAuth from 'vue-oidc/component'
```

```vue

<OAuth response-type="code" :redirect-uri="redirectUri" :logout-redirect-uri="logoutRedirectUri" />
```

if `logout-redirect-uri` is not used than token revoke endpoint will be used for logout

for oauth resource flow (default when no `response-type` is set) should be the following

```vue

<OAuth />
```

To use the component correctly, make sure of the following:

```typescript
import { createVuetify } from 'vuetify'
import { createI18n, useI18n } from 'vue-i18n'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'

const i18n = createI18n({
  messages: {
    en: {
      oauth: {
        login: 'Login',
        logout: 'Logout',
        username: 'Username',
        password: 'Password',
        usernameRequired: 'Name is required',
        passwordRequired: 'Password is required',
        usernameLength: 'Name must be less than {0} characters',
        passwordLength: 'Password must be less than {0} characters'
      }
    }
  },
})

app.use(i18n).use(createVuetify({
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n } as any)
  }
}))
```

### Sample configs

***Keycloak*** example for **oidc** with autodiscovery

```typescript
const keycloakOpenIDConfig = {
  config: {
    issuerPath: 'http://localhost:8080/realms/<some-realm>',
    clientId: '<your_client_id>',
  }
};
```

***Azure*** example

```typescript
const azureOpenIDConfig = {
  config: {
    issuerPath: 'https://login.microsoftonline.com/common/v2.0', // for common make sure you app has "signInAudience": "AzureADandPersonalMicrosoftAccount",
    clientId: '<your_client_id>',
    scope: 'openid profile email offline_access',
    pkce: true // manually, since is required, but code_challenge_methods_supported is not in openid configuration
  }
}
```

***Google*** example

```typescript
const googleOpenIDConfig = {
  config: {
    issuerPath: 'https://accounts.google.com',
    clientId: '<your_client_id>',
    clientSecret: '<your_client_secret>',
    scope: 'openid profile email'
  }
}
```

## Installing:

```
bun i vue-oidc --save
```

## App Requirements

* vue3
* vuetify/vue-i18n if using the `OAuth` component
* axios only if using `vue-oidc/axios` — the library itself needs no HTTP client

#### Licensing

[MIT License](LICENSE)
