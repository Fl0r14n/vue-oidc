import { ref, watch } from 'vue'
import type { ConfigContext } from './config'
import type { HttpContext } from './http'
import type { Jwt } from './jwt'
import type { TokenContext } from './token'
import type { OAuthFunctions, UserInfo } from './types'

export const createUser = (
  { config }: Pick<ConfigContext, 'config'>,
  { token, isAuthorized }: Pick<TokenContext, 'token' | 'isAuthorized'>,
  { http }: Pick<HttpContext, 'http'>,
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

  watch([isAuthorized, () => (config.value as any)?.userPath], async ([authorized, userPath]) => {
    if (authorized && userPath) {
      const usr = await functions.userInfo(config.value, http)
      if (usr) {
        user.value = usr
      }
    }
  })

  return { user }
}
