<template>
  <OAuth :type="type" :redirect-uri="redirectUri" :logout-redirect-uri="logoutRedirectUri" :state="state" />
</template>
<script setup lang="ts">
import OAuth from 'vue-oidc/component'

const redirectUri = `${process.env.APP_DOMAIN || globalThis.location?.origin}/oauth_callback`
const logoutRedirectUri = `${process.env.APP_DOMAIN || globalThis.location?.origin}/`
const type = process.env.OAUTH_TYPE || 'code'
const state = process.env.OAUTH_STATE || crypto.randomUUID()
</script>
