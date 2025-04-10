import { config } from '@/config'
import type { OAuthFunctions } from '@/models'
import { OAuthType } from '@/models'
import axios, { type RawAxiosRequestHeaders } from 'axios'

const HEADER_APPLICATION: RawAxiosRequestHeaders = {
  'Content-Type': 'application/x-www-form-urlencoded'
}

export const oauthFunctions: OAuthFunctions = {
  refresh: async (token) => {
    const { tokenPath, clientId, clientSecret, scope } = (config.value as any) || ({} as any)
    const { refresh_token, type } = token || {}
    if (refresh_token) {
      return await axios
        .post(
          tokenPath,
          {
            client_id: clientId,
            ...((clientSecret && { client_secret: clientSecret }) || {}),
            grant_type: 'refresh_token',
            refresh_token,
            ...((scope && { scope }) || {})
          },
          {
            headers: HEADER_APPLICATION
          }
        )
        .catch(err => err.response)
        .then(r => r?.data)
        .then(t => ({ ...t, type }))
    }
    return token
  },
  revoke: async (token) => {
    const { revokePath, clientId, clientSecret } = config.value as any
    if (revokePath) {
      const { access_token, refresh_token } = token || {}
      if (access_token) {
        await axios
          .post(
            revokePath,
            {
              ...((clientId && { client_id: clientId }) || {}),
              ...((clientSecret && { client_secret: clientSecret }) || {}),
              token: access_token,
              token_type_hint: 'access_token'
            },
            {
              headers: HEADER_APPLICATION
            }
          )
          .then(r => r?.data)
      }
      if (refresh_token) {
        await axios
          .post(
            revokePath,
            {
              ...((clientId && { client_id: clientId }) || {}),
              ...((clientSecret && { client_secret: clientSecret }) || {}),
              token: refresh_token,
              token_type_hint: 'refresh_token'
            },
            {
              headers: HEADER_APPLICATION
            }
          )
          .catch(err => err.response)
          .then(r => r?.data)
      }
    }
  },
  authorize: async (token) => {
    const { clientId, clientSecret, tokenPath, scope } = config.value as any
    const { code, redirect_uri, code_verifier } = token || {}
    return axios
      .post(
        tokenPath,
        {
          code,
          client_id: clientId,
          ...((clientSecret && { client_secret: clientSecret }) || {}),
          redirect_uri,
          grant_type: 'authorization_code',
          ...((scope && { scope }) || {}),
          ...((code_verifier && { code_verifier }) || {})
        },
        {
          headers: HEADER_APPLICATION
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.AUTHORIZATION_CODE }))
  },
  clientCredentialLogin: async () => {
    const { clientId, clientSecret, tokenPath, scope } = (config.value as any) || ({} as any)
    return axios
      .post(
        tokenPath,
        {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: OAuthType.CLIENT_CREDENTIAL,
          ...(scope ? { scope } : {})
        },
        {
          headers: HEADER_APPLICATION
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.CLIENT_CREDENTIAL }))
  },
  resourceOwnerLogin: async (parameters) => {
    const { clientId, clientSecret, tokenPath, scope } = config.value as any
    const { username, password } = parameters
    return axios
      .post(
        tokenPath,
        {
          client_id: clientId,
          ...((clientSecret && { client_secret: clientSecret }) || {}),
          grant_type: OAuthType.RESOURCE,
          ...((scope && { scope }) || {}),
          username,
          password
        },
        {
          headers: HEADER_APPLICATION
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.RESOURCE }))
  },
  openIdConfiguration: async (issuer) => {
    const { issuerPath, clientId } = config.value as any
    return axios
      .get(`${issuer || issuerPath}/.well-known/openid-configuration?client_id=${clientId}`)
      .catch(err => err.response)
      .then(r => r?.data)
  },
  userInfo: async (path, http) => {
    const { userPath } = config.value || {}
    return (http || axios)
      .get(`${path || userPath}`)
      .catch(err => err?.response)
      .then(r => r?.data)
  }
}