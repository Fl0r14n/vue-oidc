import vue from 'unplugin-vue/rolldown'
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue', 'axios'] },
    dts: true,
    clean: true
  },
  {
    entry: { component: 'src/component/index.ts' },
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue-oidc', 'vue', 'vuetify', /^vuetify\//, '@mdi/js', 'axios'] },
    plugins: [vue()],
    css: { fileName: 'component.css' },
    dts: { vue: true },
    clean: false
  }
])
