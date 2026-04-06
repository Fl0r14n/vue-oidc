import { createApp } from './main'

const app = createApp()
app
  .getRouter()
  .isReady()
  .then(() => app.mount('#app'))
