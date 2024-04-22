## Angular OAuth

> `Ngx-oauth` is a fully **OAuth 2.1** compliant angular library. The library supports all the 4 flows:
> * **resource**
> * **implicit**
> * **authorization code**
> * **client credentials**

> Supports OIDC

> `PKCE` support for authorization code with code verification

### How to

//TODO

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

//TODO how to use

## Installing:

```
npm install vue-oidc --save
```

## App Requirements

* vue3
* vuetify/vue-18n if using the `v-oauth` component

#### Licensing

[MIT License](LICENSE)
