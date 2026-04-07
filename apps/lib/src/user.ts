import axios, { type InternalAxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'
import { ref, watch } from 'vue'
import { config, ignoredPaths } from './config'
import { oauthFunctions } from './functions'
import type { OpenIdConfig, UserInfo } from './models'
import { accessToken, isAuthorized, isExpiredToken, token } from './token'

const HEADER_JSON: RawAxiosRequestHeaders = {
  'Content-Type': 'application/json'
}

const isPathIgnored = (req: InternalAxiosRequestConfig) => {
  if (ignoredPaths.value) {
    for (const ignoredPath of ignoredPaths.value) {
      try {
        if (req.url?.match(ignoredPath)) {
          return true
        }
      } catch {
        /* empty */
      }
    }
  }
  return false
}

export const http = axios.create({
  headers: HEADER_JSON
})

export const authorizationInterceptor = async (req: InternalAxiosRequestConfig) => {
  if (!isPathIgnored(req)) {
    if (isExpiredToken(token.value)) {
      token.value = {
        ...(await oauthFunctions.refresh(token.value, config.value as OpenIdConfig))
      }
    }
    if (accessToken.value) {
      req.headers.setAuthorization(accessToken.value)
    }
  }
  return req
}

export const unauthorizedInterceptor = (error: any) => {
  if (401 === error.response?.status) {
    token.value = error.response.data
  }
  return Promise.reject(error)
}

http.interceptors.request.use(authorizationInterceptor)
http.interceptors.response.use(res => res, unauthorizedInterceptor)

export const jwt = (token?: string) => {
  const payload = token?.split('.')[1]
  return payload
    ? JSON.parse(
        decodeURIComponent(
          Array.from(atob(payload))
            .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join('')
        )
      )
    : {}
}

export const user = ref<UserInfo | undefined>()

watch(
  () => token.value?.id_token,
  idToken => {
    if (idToken) {
      user.value = jwt(idToken)
    }
  },
  { immediate: true }
)

watch([isAuthorized, () => (config.value as any)?.userPath], async ([authorized, userPath]) => {
  if (authorized && userPath) {
    const usr = await oauthFunctions.userInfo(userPath, http)
    if (usr) {
      user.value = usr
    }
  }
})
