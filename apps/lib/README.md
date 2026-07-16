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
  component: () => null as any,
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

* other miscellaneous stores: `useOAuthConfig()`, `useOAuthToken()`, `useOAuthUser()`, `useOAuthHttp()`
  and `useOAuthInterceptors()`

The composables resolve the current `OAuthInstance` — via `inject(oauthKey)` inside component setup, and via
the last created/installed instance elsewhere (router guards, pinia stores). You can also hold on to the
instance returned by `createOAuth()` directly; it exposes everything the composables do
(`token`, `user`, `status`, `login`, `checkToken`, `http`, ...).

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

If your server keeps a per-request context (e.g. `AsyncLocalStorage`), register a resolver so composables
called outside setup resolve the *request's* instance even when concurrent renders interleave:

```typescript
// entry-server.ts
import { createOAuth, setOAuthResolver, type OAuthInstance } from 'vue-oidc'

const als = new AsyncLocalStorage<{ oauth?: OAuthInstance }>()
setOAuthResolver(() => als.getStore()?.oauth) // once per process

// per request:
als.run({}, async () => {
  const oauth = createOAuth({ config: {...} })
  als.getStore()!.oauth = oauth
  app.use(oauth)
  try {
    return await renderToString(app)
  } finally {
    oauth.dispose()
  }
})
```

The library itself never imports `node:async_hooks` — it stays runtime-agnostic.

#### Migrating from v3

* State moved from module scope onto the instance: multiple isolated instances are now possible and
  SSR-safe. The composable API (`useOAuth()`, `useOAuthToken()`, ...) is unchanged.
* Overriding behavior by mutating `useOAuthFunctions()` → pass `functions` to `createOAuth()` instead.
* `OAuth` type → `OAuthInstance` (deprecated alias kept).
* New exports: `oauthKey`, `defaultOAuthFunctions`, `isExpiredToken`, `setOAuthResolver`,
  `getActiveOAuth`/`setActiveOAuth`.
* Stored tokens are compatible — same default `storageKey`, same format.

#### Use Oauth functions (Optional)

```typescript
import { inject } from 'vue'

const login = inject('login') //oauth login function
const logout = inject('logout') //oauth logout function
const http = inject('http') //axios http which will append authorization token  
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
* vuetify/vue-18n if using the `OAuth` component

#### Licensing

[MIT License](LICENSE)
