import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import compression from 'compression'
import { createServer } from 'node:https'
import fs from 'fs'

const isProduction = process.env.NODE_ENV === 'production'
const root = dirname(fileURLToPath(import.meta.url))
const path = p => resolve(root, p)

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

const init = async hmrPort => {
  const app = express()
  let vite
  if (isProduction) {
    app.use(compression())
    const sirv = (await import('sirv')).default
    app.use(sirv(path('dist/client')))
  } else {
    vite = await (
      await import('vite')
    ).createServer({
      root,
      logLevel: isProduction ? 'info' : 'error',
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100
        },
        hmr: {
          port: hmrPort
        }
      },
      appType: 'custom'
    })
    app.use(vite.middlewares)
  }

  app.use('*', async (req, res) => {
    const manifest = isProduction ? JSON.parse(readFileSync(path('dist/client/.vite/ssr-manifest.json'), 'utf-8')) : {}
    try {
      let template, render
      if (isProduction) {
        template = readFileSync(path('dist/client/index.html'), 'utf-8')
        render = (await import('./dist/server/entry-server.js')).render
      } else {
        template = readFileSync(path('index.html'), 'utf-8')
        template = await vite.transformIndexHtml(req.originalUrl, template)
        render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      }
      const [appHtml, preloadLinks, state] = await render(req, manifest)
      const html = template
        .replace(`<!--preload-links-->`, preloadLinks)
        .replace(`<!--app-state-->`, state)
        .replace(`<!--app-html-->`, appHtml)
      res.status(200).setHeader('Content-Type', 'text/html').end(html)
    } catch (e) {
      if(e && vite) {
        vite.ssrFixStacktrace(e)
      }
      console.log(e)
      res.status(500).end(e)
    }
  })
  return app
}

const port = process.env.PORT || 443
createServer(https, await init()).listen(port, () => {
  console.log(`Server running at https://localhost:${port}`)
})
