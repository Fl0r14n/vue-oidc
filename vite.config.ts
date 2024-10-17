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
      script: {
        propsDestructure: true
      },
      template: {
        transformAssetUrls
      }
    }),
    vuetify({
      autoImport: { labs: true },
      styles: {
        configFile: 'src/assets/variables.scss'
      }
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern'
      },
      sass: {
        api: "modern",
      }
    }
  },
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
