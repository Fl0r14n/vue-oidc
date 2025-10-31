process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { fileURLToPath, serve } from 'bun'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { Writable } from 'stream'

let key: NonSharedBuffer | undefined
let cert: NonSharedBuffer | undefined
try {
  key = readFileSync('.cert/key.pem')
  cert = readFileSync('.cert/cert.pem')
} catch {
  /* empty */
}

const tls =
  (key &&
    cert && {
      key,
      cert
    }) ||
  undefined

const port = process.env.PORT || 3000
const mode = process.env.NODE_ENV || 'development'
const root = dirname(fileURLToPath(import.meta.url))
const path = (p: string) => resolve(root, p)

const { createServer } = await import('vite')
const vite = await createServer({
  mode,
  server: {
    middlewareMode: true
  },
  appType: 'custom'
})
const server = serve({
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
      const response = {
        mappings: [
          {
            url: `${url.origin}/`,
            path: `${root}/`
          }
        ]
      }
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const viteResponse = await new Promise<Response | null>(resolve => {
      const chunks: any[] = []
      const res: any = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk))
          callback()
        },
        final(callback) {
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
          resolve(new Response(body, { status: res.statusCode || 200, headers: res.headers }))
          callback()
        },
        destroy(err, callback) {
          if (err) {
            console.error('Stream destroyed with error:', err)
          }
          callback(err)
        }
      })

      res.headers = {}
      res.getHeader = (name: string) => res.headers[name.toLowerCase()]
      res.setHeader = (name: string, value: string | string[]) => {
        res.headers[name.toLowerCase()] = value
      }
      res.writeHead = (statusCode: number, headers: any) => {
        res.statusCode = statusCode
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            res.headers[key.toLowerCase()] = value
          }
        }
      }

      vite.middlewares(
        {
          url: url.pathname + url.search,
          method: req.method,
          headers: Object.fromEntries(req.headers.entries())
        } as any,
        res,
        () => resolve(null)
      )
    })

    if (viteResponse) {
      return viteResponse
    }

    try {
      const template = readFileSync(path('index.html'), 'utf-8')
      const view = await vite.transformIndexHtml(url.pathname, template)
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
      const { body, head, state } = await render(req)
      const html = view.replace(`<!--app-head-->`, head).replace(`<!--app-state-->`, state).replace(`<!--app-html-->`, body)
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      })
    } catch (e: any) {
      if (vite) vite.ssrFixStacktrace(e)
      console.error('SSR Error:', e)
      return new Response(e.stack, { status: 500 })
    }
  },
  port,
  tls,
  error(error) {
    console.error(error)
    return new Response('Internal Server Error', { status: 500 })
  }
})

console.log(`Listening on ${key && cert ? 'https' : 'http'}://localhost:${server.port}`)
