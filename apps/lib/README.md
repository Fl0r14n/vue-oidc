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

```typescript
import { useOAuthHttp } from 'vue-oidc/axios'

// an axios instance with both interceptors attached
const http = useOAuthHttp()
const { data } = await http.get('/api/orders')
```

The client is memoized **per `OAuth` instance**, so every call site gets the same one and interceptors you
add in a store are seen by callers everywhere else:

```typescript
// somewhere at setup — adds a header to every authorized request in the app
useOAuthHttp().interceptors.request.use(req => {
  req.params = req.params || new URLSearchParams()
  req.params.append('lang', 'en')
  return req
})
```

Per instance rather than per module, because a module-level singleton would let two concurrent SSR renders
cross interceptors. `useOAuthHttp()` takes no defaults for the same reason the memoization exists — with
several call sites sharing the client, whichever ran first would silently decide them. Use
`createAxiosClient(oauth, defaults)` when you want a separately configured client.

For a client you configure yourself, attach the pair instead:

```typescript
import axios from 'axios'
import { useOAuthInterceptors } from 'vue-oidc/axios'

const { authorizationInterceptor, unauthorizedInterceptor } = useOAuthInterceptors()
const http = axios.create({ baseURL: '/api' })
http.interceptors.request.use(authorizationInterceptor)
http.interceptors.response.use(r => r, unauthorizedInterceptor)
```

Outside any injection context — or under SSR, where the composables' pointer fallback is deliberately
ambiguous — pass the instance explicitly: `createAxiosClient(oauth, defaults?)` and
`createAxiosInterceptors(oauth)`. Build **one client per `OAuth` instance**, never a shared module-level
default: on the server two concurrent requests sharing interceptors would mean one request's bearer on
another request's call.

#### Override oauth functions (Optional)

Every network call (`refresh`, `revoke`, `authorize`, `userInfo`, ...) can be replaced per instance —
no mutation of shared objects:

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
  app.runWithContext(() => getActiveOAuth()).dispose()
}
```

`oauthCallback()` no-ops on the server: the `code_verifier` lives in the browser's storage, and a
server-side exchange without it would still burn the single-use authorization code at the IDP —
the client's own exchange would then fail with `invalid_grant`. Callback guards need no SSR check.

The library itself never imports `node:async_hooks` — it stays runtime-agnostic.

#### Migrating from v4

axios is no longer required. The protocol is six form-encoded POSTs and two GETs, which needs no client
library — making one a required peer taxed every consumer, including the ones who never touched it. The
library now runs on `fetch`, so it also works where axios is awkward: a worker, a route handler, a plain
service.

* `oauth.http` (axios instance) → `oauth.fetch` (`OAuthFetch`, the standard `fetch` signature), plus
  `oauth.authHeaders(url)` for the raw `Authorization` header.
* `useOAuthHttp()` → `useOAuthFetch()`, **or** `bun add axios` and change the import to
  `import { useOAuthHttp } from 'vue-oidc/axios'` to keep it as it was. Same semantics: one memoized
  client per instance, so interceptors attached at one call site stay visible at every other.
* `useOAuthInterceptors()` moved to `vue-oidc/axios`. `oauth.authorizationInterceptor` /
  `oauth.unauthorizedInterceptor` are gone from the instance — build them with
  `createAxiosInterceptors(oauth)` from that entry.
* `inject('http')` → `inject('fetch')`.
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
