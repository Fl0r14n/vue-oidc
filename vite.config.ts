import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

let key, cert

try {
  key = readFileSync('.cert/key.pem')
  cert = readFileSync('.cert/cert.pem')
} catch {
  /* empty */
}

const https =
  (key &&
    cert && {
      key,
      cert
    }) ||
  undefined

const port = Number.parseInt(process.env.PORT || '') || 3000

export default defineConfig({
  plugins: [
    vueDevTools(),
    vue({
      script: {
        propsDestructure: true
      },
      template: { transformAssetUrls }
    }),
    vuetify({
      autoImport: { labs: true },
      styles: {
        configFile: 'src/assets/variables.scss'
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  ssr: {
    noExternal: [/\.css$/, /^vuetify/]
  },
  server: {
    host: true,
    port,
    https,
    hmr: {
      host: 'vite.local.dev',
      protocol: 'wss'
    }
  },
  preview: {
    port
  }
})
