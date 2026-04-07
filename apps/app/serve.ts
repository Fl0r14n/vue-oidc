import vuePlugin from './vue-plugin'
import { tls } from '../../.cert'
import { watch } from 'node:fs'

const dir = import.meta.dir
const template = await Bun.file(`${dir}/index.html`).text()

const buildOptions = {
  entrypoints: [`${dir}/src/entry-client.ts`],
  plugins: [vuePlugin],
  target: 'browser',
  splitting: false,
  define: {
    'process.env': JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)))
  }
}

const buildAssets = async () => {
  const result = await Bun.build(buildOptions)
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return null
  }
  const assets = new Map<string, { text: string; type: string }>()
  for (const output of result.outputs) {
    assets.set(`/${output.path}`, { text: await output.text(), type: output.type })
  }
  const entry = result.outputs.find(o => o.kind === 'entry-point')
  if (entry) {
    assets.set('/src/entry-client.ts', { text: await entry.text(), type: entry.type })
  }
  return assets
}

let assets = await buildAssets()
if (!assets) process.exit(1)

const clients = new Set<ReadableStreamDefaultController>()

watch(`${dir}/src`, { recursive: true }, async () => {
  const rebuilt = await buildAssets()
  if (rebuilt) {
    assets = rebuilt
    for (const client of clients) {
      try {
        client.enqueue('data: reload\n\n')
      } catch {}
    }
    console.log('Rebuilt')
  }
})

const hotScript = `<script>new EventSource('/__hot').onmessage=()=>location.reload()</script>`
const hotTemplate = template.replace('</body>', `${hotScript}</body>`)
const port = Number(process.env.PORT) || 3001

Bun.serve({
  port,
  tls,
  development: true,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/__hot') {
      let controller!: ReadableStreamDefaultController
      const stream = new ReadableStream({
        start(c) {
          controller = c
          clients.add(c)
        },
        cancel() {
          clients.delete(controller)
        }
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
      })
    }

    const asset = assets?.get(url.pathname)
    if (asset) {
      return new Response(asset.text, { headers: { 'Content-Type': asset.type } })
    }

    return new Response(hotTemplate, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
})

console.log(`Dev server running at ${tls ? 'https' : 'http'}://localhost:${port}`)
