import type { DefineComponent } from 'vue'

declare const OAuth: DefineComponent<{
  type?: string
  logoutRedirectUri?: string
  redirectUri?: string
  responseType?: string
  state?: string
}>

export default OAuth
