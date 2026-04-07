import './assets/main.scss'

import { createVuetify } from 'vuetify'
import { md1 } from 'vuetify/blueprints'
import App from './App.vue'
import { de, en } from './i18n'
import { oauthCallbackGuard } from './guards'
import { createOAuth } from 'vue-oidc'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { bootstrapApp } from './app'

const {
  THEME,
  OAUTH_ISSUER_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_TOKEN_PATH,
  OAUTH_LOGOUT_PATH,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_SCOPE,
  OAUTH_PKCE
} = process.env

export const createApp = () => {
  const app = bootstrapApp(App)
  const oauth = createOAuth({
    config: {
      issuerPath: OAUTH_ISSUER_PATH,
      authorizePath: OAUTH_AUTHORIZE_PATH,
      tokenPath: OAUTH_TOKEN_PATH,
      logoutPath: OAUTH_LOGOUT_PATH,
      clientId: OAUTH_CLIENT_ID,
      clientSecret: OAUTH_CLIENT_SECRET,
      scope: OAUTH_SCOPE,
      pkce: OAUTH_PKCE && JSON.parse(OAUTH_PKCE)
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
    component: () => import('./pages/MainPage.vue')
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
        defaultTheme: THEME || 'light'
      }
    })
  )
  return app
}
