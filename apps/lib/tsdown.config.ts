import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

// Four entries, each a separate build so its externals are its own:
//   core       the protocol, with no vue in its graph — usable from a request handler or a worker.
//   index      the library. On fetch, no HTTP client in its graph.
//   axios      the optional axios adapter. The only entry that imports axios, which is what makes the
//              dependency optional rather than a tax on every consumer.
//   component  the optional vuetify UI. Keeps vuetify/@mdi out of an app that only wants composables.
export default defineConfig([
  {
    // no vue, reactive or otherwise — verify-entries asserts it, because the claim is the entry's reason to exist
    entry: { core: 'src/core/index.ts' },
    outDir: 'dist',
    format: 'esm',
    dts: true,
    clean: true
  },
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: 'esm',
    deps: { neverBundle: ['vue'] },
    dts: true,
    clean: false
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
