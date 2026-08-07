/** Checks the invariants the three build entries rely on. They all fail silently: a relative import
 * across an entry boundary just inlines a second copy of the module pointer, and axios leaking into the
 * root only shows up as a resolution error in a consumer who never installed it. Run after `build`. */
import { readFileSync } from 'node:fs'

const read = (name: string) => readFileSync(`dist/${name}`, 'utf8')

const index = read('index.mjs')
const component = read('component.mjs')
const axiosAdapter = read('axios.mjs')

const imports = (source: string) => [...source.matchAll(/^import\s.*?from\s*["']([^"']+)["']/gm)].map(m => m[1])

const failures: string[] = []
const check = (ok: boolean, failure: string) => {
  if (!ok) failures.push(failure)
}

// axios is an optional peer, which only holds while exactly one entry imports it
const importsAxios = (source: string) => imports(source).some(id => id === 'axios' || id.startsWith('axios/'))
check(!importsAxios(index), 'index.mjs imports axios — only the /axios entry may, or the optional peer becomes required')
check(!importsAxios(component), 'component.mjs imports axios — only the /axios entry may')
check(importsAxios(axiosAdapter), 'axios.mjs does not import axios — the adapter has inlined or lost it')

// each optional entry keeps the root external, so exactly one module pointer exists at runtime and the
// composables answer with the instance the app actually installed
check(
  imports(axiosAdapter).includes('vue-oidc'),
  'axios.mjs does not import the root by package name — it has inlined a second module pointer, so its composables will not see the app instance'
)
check(
  imports(component).includes('vue-oidc'),
  'component.mjs does not import the root by package name — it has inlined a second module pointer, so it will not see the app instance'
)
for (const [name, source] of [
  ['axios.mjs', axiosAdapter],
  ['component.mjs', component]
] as const) {
  check(!/\bconst createOAuth\b/.test(source), `${name} has inlined createOAuth instead of importing it — a second module pointer`)
}

// the root must stay fetch-only: it is what makes the axios peer optional and the core usable in a worker
check(!/\bfrom\s*["']vue-oidc/.test(index), 'index.mjs imports vue-oidc — the root is the package, it cannot depend on itself')

if (failures.length) {
  console.error(`✗ ${failures.length} entry invariant(s) broken:\n${failures.map(f => `  - ${f}`).join('\n')}`)
  process.exit(1)
}

console.log('✓ entry invariants hold: axios confined to the /axios entry, no inlined module pointers')
