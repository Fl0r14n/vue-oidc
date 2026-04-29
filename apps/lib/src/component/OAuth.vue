<template>
  <VNoSsr>
    <VMenu
      v-model="menu"
      rounded
      :close-on-content-click="false"
      location="bottom"
    >
      <template v-slot:activator="{ props }">
        <VBtn
          v-bind="props"
          :icon="isAuthorized ? mdiAccount : mdiAccountOutline"
        />
      </template>
      <VCard>
        <template v-if="isAuthorized">
          <slot
            name="userInfo"
            :user="user"
            :logout="signOut"
            v-if="$slots.userInfo"
          />
          <template v-else>
            <VList v-if="user?.name || user?.email">
              <VListItem :title="user.name" :subtitle="user.email">
                <template #prepend>
                  <VAvatar color="primary">
                    <VImg :src="user.picture" v-if="user.picture" />
                    <span class="text-h5" v-else v-html="user.initials" />
                  </VAvatar>
                </template>
              </VListItem>
            </VList>
          </template>
          <VCardActions>
            <VSpacer />
            <VBtn @click="signOut()">{{ t("$vuetify.oauth.logout") }}</VBtn>
          </VCardActions>
        </template>
        <template v-else>
          <template v-if="showError">
            <VCardText>
              <VAlert
                type="error"
                closable
                :text="errorDescription"
                @click:close="showError = false"
              />
            </VCardText>
          </template>
          <template v-else>
            <template v-if="responseType && responseType !== OAuthType.RESOURCE">
              <VCardActions>
                <VSpacer />
                <VBtn @click="login(props as OAuthParameters)">
                  {{ t("$vuetify.oauth.login") }}
                </VBtn>
              </VCardActions>
            </template>
            <template v-else>
              <VForm
                ref="formRef"
                v-model="form.valid"
                lazy-validation
                autocomplete="on"
                @submit.prevent="signIn()"
                @keyup.enter="signIn()"
              >
                <VCardText class="pb-0 oauth-form" style="min-width: 300px">
                  <VTextField
                    name="username"
                    required
                    autocomplete="username"
                    :prepend-inner-icon="mdiEmailOutline"
                    :label="t('$vuetify.oauth.username')"
                    :counter="length"
                    v-model="form.model.username"
                    :rules="form.rules.username"
                  />
                  <VTextField
                    name="password"
                    required
                    autocomplete="current-password"
                    :prepend-inner-icon="mdiLockOutline"
                    :append-inner-icon="visible ? mdiEyeOff : mdiEye"
                    :type="visible ? 'text' : 'password'"
                    :label="t('$vuetify.oauth.password')"
                    :counter="length"
                    v-model="form.model.password"
                    :rules="form.rules.password"
                    @click:append-inner="visible = !visible"
                  />
                </VCardText>
                <VCardActions>
                  <VSpacer />
                  <VBtn type="submit" :disabled="!form.valid">
                    {{ t("$vuetify.oauth.login") }}
                  </VBtn>
                </VCardActions>
              </VForm>
            </template>
          </template>
        </template>
      </VCard>
    </VMenu>
  </VNoSsr>
</template>
<script setup lang="ts">
import { mdiAccount, mdiAccountOutline, mdiEmailOutline, mdiEye, mdiEyeOff, mdiLockOutline } from '@mdi/js'
import { shallowRef, useTemplateRef, watch } from 'vue'
import { OAuthType, useOAuth, useOAuthUser } from 'vue-oidc'
import { useLocale } from 'vuetify'
import {
  VAlert,
  VAvatar,
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VForm,
  VImg,
  VList,
  VListItem,
  VMenu,
  VNoSsr,
  VSpacer,
  VTextField
} from 'vuetify/components'
import type { AuthorizationCodeParameters, OAuthParameters, ResourceOwnerParameters } from '../types'

export type OAuthProps = Partial<ResourceOwnerParameters & AuthorizationCodeParameters & { logoutRedirectUri: string }>

const length = 128
const { t } = useLocale()
const { login, logout, isAuthorized, hasError, errorDescription } = useOAuth()
const user = useOAuthUser()
const props = defineProps<OAuthProps>()
const visible = shallowRef(false)
const showError = shallowRef(false)
const formRef = useTemplateRef('formRef')
const menu = shallowRef(false)
const form = shallowRef({
  valid: false,
  model: {
    username: props.username || '',
    password: props.password || ''
  },
  rules: {
    username: [
      (v: string) => !!v || t('$vuetify.oauth.usernameRequired'),
      (v: string) => (v && v.length <= length) || t('$vuetify.oauth.usernameLength', [length])
    ],
    password: [
      (v: string) => !!v || t('$vuetify.oauth.passwordRequired'),
      (v: string) => (v && v.length <= length) || t('$vuetify.oauth.passwordLength', [length])
    ]
  }
})

const signIn = async () => {
  const { valid, model } = form.value
  if (valid) {
    await login(model)
    formRef.value?.reset()
  }
}

const signOut = async () => {
  menu.value = false
  await logout(props.logoutRedirectUri)
}

watch(
  user,
  () => {
    if (user.value) {
      const { given_name, family_name } = user.value
      if (given_name || family_name) {
        user.value.initials = `${given_name?.charAt(0) || ''}${family_name?.charAt(0) || ''}`
      } else {
        user.value.initials = `?`
      }
    }
  },
  { immediate: true }
)

watch(
  hasError,
  hasError => {
    if (hasError) showError.value = true
  },
  { deep: true }
)
</script>
