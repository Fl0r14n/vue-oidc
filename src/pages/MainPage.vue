<template>
  <OAuth :type="type" :redirect-uri="redirectUri" :logout-redirect-uri="logoutRedirectUri" />
</template>
<script setup lang="ts">
  import { OAuth } from 'vue-oidc'

  const redirectUri = `${import.meta.env.VITE_APP_DOMAIN || globalThis.location?.origin}/oauth_callback`
  const logoutRedirectUri = `${import.meta.env.VITE_APP_DOMAIN || globalThis.location?.origin}/`
  const type = import.meta.env.VITE_OAUTH_TYPE || 'code'
</script>
