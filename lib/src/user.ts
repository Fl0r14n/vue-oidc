import { config, ignoredPaths } from '@/config'
import type { UserInfo } from '@/models'
import { accessToken, isAuthorized, isExpiredToken, token } from '@/token'
import axios, { type InternalAxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'
import { ref, watch } from 'vue'
import { oauthFunctions } from '@/functions'

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
        ...(await oauthFunctions.refresh(token.value)),
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
  return Promise.reject(error.response?.data)
}

http.interceptors.request.use(authorizationInterceptor)
http.interceptors.response.use(res => res, unauthorizedInterceptor)

export const jwt = (token?: string) =>
  token
    ? JSON.parse(
      decodeURIComponent(
        Array.from(atob(token.split('.')[1]))
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    )
    : {}

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
