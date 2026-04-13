// Types
import type { App } from 'vue'
import { createPinia } from 'pinia'
import router from '../router'
/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */
import i18n from './i18n'
import rules from './rules'
// Plugins
import vuetify from './vuetify'

export function registerPlugins (app: App) {
  app.use(vuetify)
  app.use(createPinia())
  app.use(i18n)
  app.use(router)
  app.use(rules)

  app.config.globalProperties.$gt = (key: string) => {
    const translated = i18n.global.t(key)
    return typeof translated === 'string' ? translated : String(translated)
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $gt: (key: string) => string
  }
}
