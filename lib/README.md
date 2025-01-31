## Vue OAuth

> `vue-oidc` is a fully **OAuth 2.1** compliant angular library. The library supports all the 4 flows:
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

```vue

<OAuth type="code" :redirect-uri="redirectUri" :logout-redirect-uri="logoutRedirectUri" />
```

if `logout-redirect-uri` is not used than token revoke endpoint will be used for logout

for oauth resource flow should be the following

```vue

<OAuth type="password" />
```

To use the component correctly, make sure of the following:

```typescript
import 'vue-oidc/dist/vue-oidc.css'
import '@mdi/font/scss/materialdesignicons.scss'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { createI18n, useI18n } from 'vue-i18n'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { md1 } from 'vuetify/blueprints'

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
  },
  blueprint: md1,
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
  type: OAuthType.AUTHORIZATION_CODE,
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
npm install vue-oidc --save
```

## App Requirements

* vue3
* vuetify/vue-18n if using the `OAuth` component

#### Licensing

[MIT License](LICENSE)
