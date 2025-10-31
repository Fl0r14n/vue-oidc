import { type AppContext, type Component, createApp, createSSRApp, getCurrentInstance } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, type Router, routerKey } from 'vue-router'
import { createPinia, getActivePinia } from 'pinia'

declare module 'vue' {
  interface App {
    getRouter: () => Router
    getState: () => Record<string, any>
    getComponent: (name: string, id?: string) => Component
  }
}

const { BASE_URL, SSR } = import.meta.env

const _getComponent = (ctx: AppContext, name: string, uid?: string) =>
  (uid && ctx.components[`${name}-${uid}`]) ||
  ctx.components[name] ||
  console.warn(`CMS component identified by name: ${name} and/or uid: ${uid} was not found`)

export const bootstrapApp = (comp: Component, ctx?: Record<string, unknown> | null) => {
  const app = import.meta.env.SSR ? createSSRApp(comp, ctx) : createApp(comp, ctx)
  const { state } = globalThis as any
  const pinia = createPinia()
  if (state) {
    pinia.state.value = state
  }
  app.use(pinia)
  const router = createRouter({
    history: SSR ? createMemoryHistory(BASE_URL) : createWebHistory(BASE_URL),
    routes: []
  })
  app.use(router)
  app.getComponent = (name, id) => _getComponent(app._context, name, id) as Component
  app.getRouter = () => app._context.provides[routerKey as any] as Router
  app.getState = () => pinia.state.value
  return app
}

export const getComponent = (name: string, uid?: string) => {
  const app = getCurrentInstance()
  return (app && _getComponent(app.appContext, name, uid)) || undefined
}

export const useRouter = () => (getActivePinia() as any)?._a.config.globalProperties.$router as Router
