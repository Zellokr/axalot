<script setup lang="ts">
import { en, es } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocales = { en, es } as const
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? en)

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: computed(() => uiLocale.value.code),
    dir: computed(() => uiLocale.value.dir)
  }
})

useSeoMeta({
  title: 'Axalot',
  ogTitle: 'Axalot'
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
