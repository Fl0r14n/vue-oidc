import axios, { type InternalAxiosRequestConfig } from 'axios'
import { ignoredPaths } from './config'
import { accessToken, checkToken, token } from './token'

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

export const authorizationInterceptor = async (req: InternalAxiosRequestConfig) => {
  if (!isPathIgnored(req)) {
    await checkToken()
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

export const http = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})
http.interceptors.request.use(authorizationInterceptor)
http.interceptors.response.use(res => res, unauthorizedInterceptor)
