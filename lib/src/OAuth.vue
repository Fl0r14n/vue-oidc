<template>
  <VNoSsr>
    <VMenu v-model="menu" rounded :close-on-content-click="false" location="bottom">
      <template v-slot:activator="{ props }">
        <VBtn v-bind="props" :icon="isAuthorized ? mdiAccount : mdiAccountOutline" />
      </template>
      <VCard>
        <template v-if="isAuthorized">
          <slot name="userInfo" :user="user" :logout="signOut" v-if="$slots.userInfo" />
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
            <VBtn @click="signOut()">{{ t('oauth.logout') }}</VBtn>
          </VCardActions>
        </template>
        <template v-else>
          <template v-if="showError">
            <VCardText>
              <VAlert type="error" closable :text="errorDescription" @click:close="showError = false" />
            </VCardText>
          </template>
          <template v-else>
            <template v-if="type === OAuthType.RESOURCE">
              <VForm ref="f" v-model="form.valid" lazy-validation autocomplete="on" @submit.prevent="signIn()"
                     @keyup.enter="signIn()">
                <VCardText class="pb-0 oauth-form">
                  <VTextField
                    name="username"
                    required
                    :prepend-inner-icon="mdiEmailOutline"
                    :label="t('oauth.username')"
                    :counter="length"
                    v-model="form.model.username"
                    :rules="form.rules.username" />
                  <VTextField
                    name="password"
                    required
                    :prepend-inner-icon="mdiLockOutline"
                    :append-inner-icon="visible ? mdiEyeOff : mdiEye"
                    :type="visible ? 'text' : 'password'"
                    :label="t('oauth.password')"
                    :counter="length"
                    v-model="form.model.password"
                    :rules="form.rules.password"
                    @click:append-inner="visible = !visible" />
                </VCardText>
                <VCardActions>
                  <VSpacer />
                  <VBtn type="submit" :disabled="!form.valid">
                    {{ t('oauth.login') }}
                  </VBtn>
                </VCardActions>
              </VForm>
            </template>
            <template v-else>
              <VCardActions>
                <VSpacer />
                <VBtn @click="login({ responseType: responseType || type, redirectUri: getRedirectUri(), state })">
                  {{ t('oauth.login') }}
                </VBtn>
              </VCardActions>
            </template>
          </template>
        </template>
      </VCard>
    </VMenu>
  </VNoSsr>
</template>
<script setup lang="ts">
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
  import { OAuthType } from '@/models'
  import { useOAuth, useOAuthUser } from '@/module'
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { mdiAccount, mdiAccountOutline, mdiEmailOutline, mdiEye, mdiEyeOff, mdiLockOutline } from '@mdi/js'

  const length = 128
  const { t } = useI18n()
  const { login, logout, isAuthorized, hasError, errorDescription } = useOAuth()
  const user = useOAuthUser()
  const props = withDefaults(
    defineProps<{
      type?: OAuthType | string
      logoutRedirectUri?: string
      redirectUri?: string
      responseType?: string
      state?: string
    }>(),
    {
      type: 'password'
    }
  )
  const visible = ref(false)
  const showError = ref(false)
  const f = ref<any>()
  const menu = ref(false)
  const form = ref({
    valid: false,
    model: {
      username: '',
      password: ''
    },
    rules: {
      username: [
        (v: string) => !!v || t('oauth.usernameRequired'),
        (v: string) => (v && v.length <= length) || t('oauth.usernameLength', [length])
      ],
      password: [
        (v: string) => !!v || t('oauth.passwordRequired'),
        (v: string) => (v && v.length <= length) || t('oauth.passwordLength', [length])
      ]
    }
  })

  const signIn = async () => {
    let { valid, model } = form.value
    if (valid) {
      await login(model)
      f.value?.reset()
    }
  }

  const signOut = async () => {
    menu.value = false
    await logout(props.logoutRedirectUri)
  }

  const getRedirectUri = () => {
    const { origin, pathname, search } = globalThis.location || {}
    return props.redirectUri || `${origin}${pathname}${search}`
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

  watch(hasError, hasError => hasError && (showError.value = true), { deep: true })
</script>
<style lang="scss">
  .oauth-form {
    min-width: 300px;
  }
</style>
