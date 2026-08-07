import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

// Three entries, each a separate build so its externals are its own:
//   index      the library. On fetch, no HTTP client in its graph.
//   axios      the optional axios adapter. The only entry that imports axios, which is what makes the
//              dependency optional rather than a tax on every consumer.
//   component  the optional vuetify UI. Keeps vuetify/@mdi out of an app that only wants composables.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue'] },
    dts: true,
    clean: true
  },
  {
    // the only entry that imports axios, which is why the dependency is optional
    entry: { axios: 'src/axios/index.ts' },
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue-oidc', 'vue', 'axios'] },
    dts: true,
    clean: false
  },
  {
    entry: { component: 'src/component/index.ts' },
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue-oidc', 'vue', 'vuetify', /^vuetify\//, '@mdi/js'] },
    plugins: [vue()],
    css: { fileName: 'component.css' },
    dts: { vue: true },
    clean: false
  }
])
