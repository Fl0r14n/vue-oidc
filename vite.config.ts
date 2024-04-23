import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import fs from 'fs'

let key, cert

try {
  key = fs.readFileSync('.cert/key.pem')
  cert = fs.readFileSync('.cert/cert.pem')
} catch { /* empty */
}

const https = key && cert && {
  key,
  cert
} || undefined

export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls
      }
    }),
    vuetify({
      autoImport: true,
      styles: {
        configFile: '@/assets/variables.scss'
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: { 'process.env': process.env || {} },
  ssr: {
    noExternal: [/\.css$/, /^vuetify/]
  },
  server: {
    port: 4200,
    https
  }
})
