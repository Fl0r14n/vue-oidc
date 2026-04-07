import { render } from './src/entry-server'
import vuePlugin from './vue-plugin'
import { tls } from '../../.cert'

const dir = import.meta.dir

const template = await Bun.file(`${dir}/index.html`).text()

const clientBuild = await Bun.build({
  entrypoints: [`${dir}/src/entry-client.ts`],
  plugins: [vuePlugin],
  target: 'browser',
  splitting: false,

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
  async fetch(req) {
    const url = new URL(req.url)

    const asset = assets.get(url.pathname)
    if (asset) {
      return new Response(asset.text, { headers: { 'Content-Type': asset.type } })
    }

    try {
      const { body, head, state } = await render(req, null)
      const html = template.replace('<!--app-head-->', head).replace('<!--app-html-->', body).replace('<!--app-state-->', state)
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    } catch (e) {
      console.error(e)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
})

console.log(`SSR server running at http://localhost:${port}`)
