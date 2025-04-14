import type { OAuthFunctions } from '@/models'
import { OAuthType } from '@/models'
import axios, { type RawAxiosRequestHeaders } from 'axios'

const HEADERS: RawAxiosRequestHeaders = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json'
}

export const oauthFunctions: OAuthFunctions = {
  refresh: async (token, config) => {
    const { tokenPath, clientId, clientSecret, scope } = config || {}
    const { refresh_token, type } = token || {}
    return refresh_token && tokenPath && await axios
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
          headers: HEADERS
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type })) || token
  },
  revoke: async (token, config) => {
    const { revokePath, clientId, clientSecret } = config || {}
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
              headers: HEADERS
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
              headers: HEADERS
            }
          )
          .catch(err => err.response)
          .then(r => r?.data)
      }
    }
  },
  authorize: async (token, config) => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    const { code, redirect_uri, code_verifier } = token || {}
    return code && tokenPath && await axios
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
          headers: HEADERS
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.AUTHORIZATION_CODE })) || token
  },
  clientCredentialLogin: async (config) => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    return tokenPath && await axios
      .post(
        tokenPath,
        {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: OAuthType.CLIENT_CREDENTIAL,
          ...(scope ? { scope } : {})
        },
        {
          headers: HEADERS
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.CLIENT_CREDENTIAL })) || undefined
  },
  resourceOwnerLogin: async (parameters, config) => {
    const { clientId, clientSecret, tokenPath, scope } = config || {}
    const { username, password } = parameters
    return tokenPath && clientId && await axios
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
          headers: HEADERS
        }
      )
      .catch(err => err.response)
      .then(r => r?.data)
      .then(t => ({ ...t, type: OAuthType.RESOURCE })) || undefined
  },
  openIdConfiguration: async (config) => {
    const { issuerPath, clientId } = config || {}
    return issuerPath && await axios
      .get(`${issuerPath}/.well-known/openid-configuration?client_id=${clientId}`)
      .catch(err => err.response)
      .then(r => r?.data) || undefined
  },
  userInfo: async (config, http) => {
    const { userPath } = config || {}
    return userPath && await (http || axios)
      .get(userPath)
      .catch(err => err?.response)
      .then(r => r?.data) || undefined
  },
  introspect: async (token, config) => {
    const { introspectionPath, clientId, clientSecret } = config || {}
    const { access_token } = token || {}
    return introspectionPath && access_token && clientId && await axios
      .post(
        introspectionPath,
        {
          token: access_token
        },
        {
          headers: {
            ...HEADERS,
            'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
          }
        }
      )
      .catch(err => err.response)
      .then(r => r?.data) || undefined
  }
}