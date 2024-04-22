<template>
  <v-menu v-model="menu" rounded :close-on-content-click="false" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" :icon="isAuthorized ? 'mdi-account' : 'mdi-account-outline'" />
    </template>
    <v-card>
      <template v-if="isAuthorized">
        <slot name="userInfo" :user="user" :logout="signOut" v-if="$slots.user" />
        <template v-else>
          <v-list v-if="user.name">
            <v-list-item :title="user.name" :subtitle="user.email">
              <template #prepend>
                <v-avatar color="primary">
                  <v-img :src="user.picture" v-if="user.picture" />
                  <span class="text-h5" v-else v-html="user.initials" />
                </v-avatar>
              </template>
            </v-list-item>
          </v-list>
        </template>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="signOut()">{{ t('oauth.logout') }}</v-btn>
        </v-card-actions>
      </template>
      <template v-else>
        <template v-if="showError">
          <v-card-text>
            <v-alert type="error" closable :text="errorDescription" @click:close="showError = false" />
          </v-card-text>
        </template>
        <template v-else>
          <template v-if="type === OAuthType.RESOURCE">
            <v-form ref="f" v-model="form.valid" lazy-validation autocomplete="on" @submit.prevent="signIn()" @keyup.enter="signIn()">
              <v-card-text class="pb-0 oauth-form">
                <v-text-field
                  name="username"
                  required
                  prepend-inner-icon="mdi-email-outline"
                  :label="t('oauth.username')"
                  :counter="length"
                  v-model="form.model.username"
                  :rules="form.rules.username" />
                <v-text-field
                  name="password"
                  required
                  prepend-inner-icon="mdi-lock-outline"
                  :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                  :type="visible ? 'text' : 'password'"
                  :label="t('oauth.password')"
                  :counter="length"
                  v-model="form.model.password"
                  :rules="form.rules.password"
                  @click:append-inner="visible = !visible" />
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn type="submit" :disabled="!form.valid">
                  {{ t('oauth.login') }}
                </v-btn>
              </v-card-actions>
            </v-form>
          </template>
          <template v-else>
            <v-card-actions>
              <v-spacer />
              <v-btn @click="login({ responseType: responseType || type, redirectUri: getRedirectUri(), state })">
                {{ t('oauth.login') }}
              </v-btn>
            </v-card-actions>
          </template>
        </template>
      </template>
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
  import { OAuthType } from '@/models'
  import { useOAuth, useOAuthUser } from '@/module'
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { VForm } from 'vuetify/components'

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
    const { origin, pathname, search } = location
    return props.redirectUri || `${origin}${pathname}${search}`
  }

  watch(
    user,
    () => {
      const { given_name, family_name } = user.value
      if (given_name || family_name) {
        user.value.initials = `${given_name?.charAt(0) || ''}${family_name?.charAt(0) || ''}`
      } else {
        user.value.initials = `?`
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
