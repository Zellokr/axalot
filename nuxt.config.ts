// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@comark/nuxt',
    'better-convex-nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
    '/overview': { prerender: true }
  },

  compatibilityDate: '2026-06-30',

  typescript: {
    strict: true
  },

  convex: {
    auth: {
      enabled: false
    },

    defaults: {
      auth: 'none'
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    langDir: 'locales',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es-ES', name: 'Español', file: 'es.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'axalot_locale',
      alwaysRedirect: false,
      fallbackLocale: 'en',
      redirectOn: 'all'
    }
  }
})
