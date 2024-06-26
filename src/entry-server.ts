import { basename } from 'node:path'
import { renderToString } from 'vue/server-renderer'
import { createApp } from './main'
import * as express from 'express'

export const render = async (req: express.Request, manifest: any) => {
  const { app, router, pinia } = createApp(req)
  await router.push(req.originalUrl)
  await router.isReady()
  const ctx: any = {}
  const html = await renderToString(app, ctx)
  const preloadLinks = renderPreloadLinks(ctx.modules, manifest)
  const state = {
    pinia: pinia.state.value
  }
  return [html, preloadLinks, `var state = ${JSON.stringify(state)}`]
}

const renderPreloadLinks = (modules: any, manifest: any) => {
  let links = ''
  const seen = new Set()
  modules.forEach(id => {
    const files = manifest[id]
    if (files) {
      files.forEach(file => {
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
