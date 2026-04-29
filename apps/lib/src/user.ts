import { ref, watch } from 'vue'
import { config } from './config'
import { oauthFunctions } from './functions'
import { http } from './http'
import { jwt } from './jwt'
import { isAuthorized, token } from './token'
import type { UserInfo } from './types'

export const user = ref<UserInfo | undefined>()

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
    const usr = await oauthFunctions.userInfo(userPath, http)
    if (usr) {
      user.value = usr
    }
  }
})
