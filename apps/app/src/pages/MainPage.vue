<template>
  <OAuth v-bind="config" />
</template>
<script setup lang="ts">
import OAuth, { type OAuthProps } from 'vue-oidc/component'

const config: OAuthProps = {
  responseType: import.meta.env.VITE_OAUTH_TYPE || 'code',
  redirectUri: `${import.meta.env.VITE_APP_DOMAIN || globalThis.location?.origin}/oauth_callback`,
  logoutRedirectUri: `${import.meta.env.VITE_APP_DOMAIN || globalThis.location?.origin}/`,
  state: import.meta.env.VITE_OAUTH_STATE || crypto.randomUUID(),
  accessType: 'offline'
}
</script>
