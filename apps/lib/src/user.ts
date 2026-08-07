import { ref, watch } from 'vue'
import type { ConfigContext } from './config'
import type { FetchContext } from './fetch'
import type { Jwt } from './jwt'
import type { TokenContext } from './token'
import type { OAuthFunctions, UserInfo } from './types'

export const createUser = (
  { config }: Pick<ConfigContext, 'config'>,
  { token, isAuthorized }: Pick<TokenContext, 'token' | 'isAuthorized'>,
  { oauthFetch }: Pick<FetchContext, 'oauthFetch'>,
  functions: OAuthFunctions,
  jwt: Jwt
) => {
  const user = ref<UserInfo | undefined>()

  watch(
    () => token.value?.id_token,
    async idToken => {
      if (idToken) {
        user.value = await jwt(idToken)
      }
    },
    { immediate: true }
  )

  // immediate: with a valid stored token and a statically configured userPath both sources are
  // already truthy at instance creation and never change — without it the fetch never fires
  watch(
    [isAuthorized, () => (config.value as any)?.userPath],
    async ([authorized, userPath]) => {
      if (authorized && userPath) {
        const usr = await functions.userInfo(config.value, oauthFetch)
        if (usr) {
          user.value = usr
        }
      }
    },
    { immediate: true }
  )

  return { user }
}
