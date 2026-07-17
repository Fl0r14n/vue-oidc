import { renderToString } from 'vue/server-renderer'
import { getActiveOAuth } from 'vue-oidc'
import { createApp } from './main'

const getURL = (req: any) => {
  if (req?.url && !req?.originalUrl) {
    return new URL(req.url)
  }
  let href = 'http://localhost'
  const host =
    req.headers['x-forwarded-host'] || req.headers.host || `${req.hostname}:${req.socket?.localPort || req.socket?.address().port}`
  href = `${req.protocol}://${host}${req.originalUrl}`
  return new URL(href)
}

export const render = async (req: any, manifest: any) => {
  const url = getURL(req)
  const app = createApp()
  try {
    const router = app.getRouter()
    await router.push(`${url.pathname}${url.search}`)
    await router.isReady()
    const ctx: any = {}
    const body = await renderToString(app, ctx)
    const head = renderPreloadLinks(ctx.modules, manifest)
    const state = app.getState()
    return { body, head, state: `var state = ${JSON.stringify(state)}` }
  } finally {
    app.runWithContext(() => getActiveOAuth()).dispose()
  }
}

const basename = (path: string): string => path.split(/[\\/]/).pop() || ''

const renderPreloadLink = (file: string) => {
  if (file.endsWith('.js')) {
    return `<link rel="modulepreload" crossorigin href="${file}">`
  } else if (file.endsWith('.css')) {
    return `<link rel="stylesheet" href="${file}">`
  } else if (file.endsWith('.woff')) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`
  } else if (file.endsWith('.woff2')) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`
  } else if (file.endsWith('.gif')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/gif">`
  } else if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/jpeg">`
  } else if (file.endsWith('.png')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/png">`
  } else {
    return ''
  }
}

const renderPreloadLinks = (modules: any, manifest: any) => {
  let links = ''
  const seen = new Set()
  modules.forEach((id: any) => {
    const files = manifest?.[id]
    if (files) {
      files.forEach((file: string) => {
        if (!seen.has(file)) {
          seen.add(file)
          const filename = basename(file)
          if (manifest[filename]) {
            for (const depFile of manifest[filename]) {
              links += renderPreloadLink(depFile)
              seen.add(depFile)
            }
          }
          links += renderPreloadLink(file)
        }
      })
    }
  })
  return links
}
