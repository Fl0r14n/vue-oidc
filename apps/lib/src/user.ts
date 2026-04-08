import axios, { type InternalAxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ref, watch } from 'vue'
import { config, ignoredPaths } from './config'
import { oauthFunctions } from './functions'
import { accessToken, isAuthorized, isExpiredToken, token } from './token'
import type { OpenIdConfig, UserInfo } from './types'

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

export const jwt = (idToken?: string) => {
  const payload = idToken?.split('.')[1]
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

let jwksSet: ReturnType<typeof createRemoteJWKSet> | undefined

watch(
  () => (config.value as OpenIdConfig)?.jwksUri,
  jwksUri => {
    jwksSet = jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : undefined
  },
  { immediate: true }
)

export const verifyJwt = async (idToken?: string) => {
  if (!idToken) return {}
  if (!jwksSet) return jwt(idToken)
  const { issuerPath, clientId } = (config.value as OpenIdConfig) || {}
  try {
    const { payload } = await jwtVerify(idToken, jwksSet, {
      ...(issuerPath && { issuer: issuerPath }),
      ...(clientId && { audience: clientId })
    })
    return payload as Record<string, any>
  } catch {
    return { error: 'Invalid token' }
  }
}

export const user = ref<UserInfo | undefined>()

watch(
  () => token.value?.id_token,
  async idToken => {
    if (idToken) {
      user.value = await verifyJwt(idToken)
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
