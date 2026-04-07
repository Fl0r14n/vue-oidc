import vuePlugin from './vue-plugin'
import { tls } from '../../.cert'

const dir = import.meta.dir

const template = await Bun.file(`${dir}/index.html`).text()

const clientBuild = await Bun.build({
  entrypoints: [`${dir}/src/entry-client.ts`],
  plugins: [vuePlugin],
  target: 'browser',
  splitting: false,
  define: {
    'process.env': JSON.stringify(
      Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined))
    )
  }
})

if (!clientBuild.success) {
  for (const log of clientBuild.logs) console.error(log)
  process.exit(1)
}

const assets = new Map<string, { text: string; type: string }>()
for (const output of clientBuild.outputs) {
  assets.set(`/${output.path}`, { text: await output.text(), type: output.type })
}

const entryOutput = clientBuild.outputs.find(o => o.kind === 'entry-point')
if (entryOutput) {
  assets.set('/src/entry-client.ts', { text: await entryOutput.text(), type: entryOutput.type })
}

const port = Number(process.env.PORT) || 3001

Bun.serve({
  port,
  tls,
  development: true,
  async fetch(req) {
    const url = new URL(req.url)

    const asset = assets.get(url.pathname)
    if (asset) {
      return new Response(asset.text, { headers: { 'Content-Type': asset.type } })
    }

    return new Response(template, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
})

console.log(`Dev server running at ${tls ? 'https' : 'http'}://localhost:${port}`)
