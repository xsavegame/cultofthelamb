let baseURL = process.env.NUXT_APP_BASE_URL ?? '/';

if (!baseURL.endsWith('/')) {
  baseURL += '/';
}

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxt/image', '@pinia/nuxt', 'json-editor-vue/nuxt'],
  css: ['@/assets/scss/global.scss'],

  app: {
    baseURL,
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Cult of the Lamb - Save file editor',
      htmlAttrs: {
        lang: 'en',
        'data-bs-theme': 'dark',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://cotl.xl0.org/', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://cotl.xl0.org/' },
      ],
      meta: [
        {
          name: 'description',
          content: 'a save file editor for a game called Cult of the Lamb',
        },
        {
          property: 'og:title',
          content: 'Cult of the Lamb - Save file editor',
        },
        {
          property: 'og:descrption',
          content: 'a save file editor for a game called Cult of the Lamb',
        },
        { name: 'color-scheme', content: 'dark' },
        { name: 'theme-color', content: '#eeeeee' },
      ],
    },
  },

  typescript: {
    shim: false,
    strict: true,
    typeCheck: true,
  },

  compatibilityDate: '2025-02-05',
});
