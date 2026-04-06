import '@/assets/main.scss'

import { createVuetify } from 'vuetify'
import { md1 } from 'vuetify/blueprints'
import App from '@/App.vue'
import { de, en } from '@/i18n'
import { oauthCallbackGuard } from '@/guards'
import { createOAuth } from 'vue-oidc'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { bootstrapApp } from '@/app.ts'

const {
  VITE_THEME,
  VITE_OAUTH_ISSUER_PATH,
  VITE_OAUTH_AUTHORIZE_PATH,
  VITE_OAUTH_TOKEN_PATH,
  VITE_OAUTH_LOGOUT_PATH,
  VITE_OAUTH_CLIENT_ID,
  VITE_OAUTH_CLIENT_SECRET,
  VITE_OAUTH_SCOPE,
  VITE_OAUTH_PKCE
} = import.meta.env

export const createApp = () => {
  const app = bootstrapApp(App)
  const oauth = createOAuth({
    config: {
      issuerPath: VITE_OAUTH_ISSUER_PATH,
      authorizePath: VITE_OAUTH_AUTHORIZE_PATH,
      tokenPath: VITE_OAUTH_TOKEN_PATH,
      logoutPath: VITE_OAUTH_LOGOUT_PATH,
      clientId: VITE_OAUTH_CLIENT_ID,
      clientSecret: VITE_OAUTH_CLIENT_SECRET,
      scope: VITE_OAUTH_SCOPE,
      pkce: VITE_OAUTH_PKCE && JSON.parse(VITE_OAUTH_PKCE)
    }
  })
  console.log(oauth.config.value)
  const router = app.getRouter()
  router.beforeEach(to => {
    const resolve = router.resolve(to)
    if (!to.matched.length && resolve.matched?.length) {
      return resolve
    }
  })
  router.addRoute({
    path: '/',
    name: 'main',
    component: () => import('@/pages/MainPage.vue')
  })
  router.addRoute({
    path: '/oauth_callback',
    name: 'oauthCallback',
    component: () => null as any,
    beforeEnter: oauthCallbackGuard
  })
  router.addRoute({
    path: '/:catchAll(.*)',
    redirect: '/main'
  })
  app.use(oauth).use(
    createVuetify({
      icons: {
        defaultSet: 'mdi',
        aliases,
        sets: {
          mdi
        }
      },
      ssr: {
        clientWidth: 1920,
        clientHeight: 1080
      },
      blueprint: md1,
      locale: {
        locale: globalThis.navigator?.language?.split('-')?.[0] || 'en',
        fallback: 'en',
        messages: {
          en,
          de
        }
      },
      defaults: {
        VTextField: {
          density: 'compact'
        },
        VBtn: {
          variant: 'text'
        },
        VCheckbox: {
          density: 'compact'
        },
        VAlert: {
          variant: 'tonal',
          closable: true
        },
        VRating: {
          density: 'compact'
        }
      },
      theme: {
        defaultTheme: VITE_THEME || 'light'
      }
    })
  )
  return app
}
