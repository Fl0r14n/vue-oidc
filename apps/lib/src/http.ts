import axios, { type InternalAxiosRequestConfig } from 'axios'
import type { ConfigContext } from './config'
import type { TokenContext } from './token'

export const createHttp = (
  { isPathIgnored }: Pick<ConfigContext, 'isPathIgnored'>,
  { token, accessToken, checkToken }: Pick<TokenContext, 'token' | 'accessToken' | 'checkToken'>
) => {
  const authorizationInterceptor = async (req: InternalAxiosRequestConfig) => {
    if (!isPathIgnored(req.url)) {
      await checkToken()
      if (accessToken.value) {
        req.headers.setAuthorization(accessToken.value)
      }
    }
    return req
  }

  const unauthorizedInterceptor = (error: any) => {
    if (401 === error.response?.status) {
      token.value = error.response.data
    }
    return Promise.reject(error)
  }

  const http = axios.create({
    headers: {
      'Content-Type': 'application/json'
    }
  })
  http.interceptors.request.use(authorizationInterceptor)
  http.interceptors.response.use(res => res, unauthorizedInterceptor)

  return {
    http,
    authorizationInterceptor,
    unauthorizedInterceptor
  }
}

export type HttpContext = ReturnType<typeof createHttp>
