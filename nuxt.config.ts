import fs from 'fs';

let baseURL = process.env.NUXT_APP_BASE_URL ?? '/';

if (!baseURL.endsWith('/')) {
  baseURL += '/';
}

const routes: string[] = [];

if (
  process.env.NODE_ENV === 'production' &&
  process.env.APP_ENV === 'github_pages'
) {
  function generateRoute(
    dir: string,
    options: { quality?: number; size?: string[]; fitinside?: boolean } = {}
  ) {
    const mergeOption = {
      ...{ quality: 100, size: ['64x64'], fitinside: true },
      ...options,
    };

    if (mergeOption.size.length === 0) {
      mergeOption.size = [''];
    }

    fs.readdirSync(`./public/${dir}`).forEach((file) => {
      if (/\.(png|jpg|jpeg)$/.test(file)) {
        for (const size of mergeOption.size) {
          const query = [];

          if (mergeOption.quality) {
            query.push(`q_${mergeOption.quality}`);
          }

          if (mergeOption.fitinside) {
            query.push('fit_inside');
          }

          if (size) {
            query.push(`s_${size}`);
          }

          if (query.length > 0) {
            routes.push(`/_ipx/${query.join('&')}/${dir}/${file}`);
          }
        }
      }
    });
  }

  generateRoute('Cooking_Recipes', { size: ['128x128', '64x64'] });
  generateRoute('Traits', { size: ['128x128', '64x64'] });
  generateRoute('Items', { size: ['128x128', '64x64'], quality: 0 });
  generateRoute('Tarot_Cards', { size: [] });
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
        { rel: 'icon', type: 'image/x-icon', href: `${baseURL}favicon.ico` },
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

  image: {
    provider: 'ipx',
  },

  typescript: {
    shim: false,
    strict: true,
    typeCheck: true,
  },

  nitro: {
    prerender: {
      routes,
    },
  },

  compatibilityDate: '2025-02-05',
});
