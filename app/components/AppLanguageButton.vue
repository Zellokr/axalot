<script setup lang="ts">
const { locale, setLocale, t } = useI18n()
const targetLocale = computed(() => locale.value === 'en' ? 'es' : 'en')
const targetCode = computed(() => targetLocale.value.toUpperCase())
const targetLabel = computed(() => t(`common.language.switchTo.${targetLocale.value}`))

async function toggleLocale() {
  await setLocale(targetLocale.value)
}
</script>

<template>
  <UButton
    icon="i-lucide-languages"
    color="neutral"
    variant="ghost"
    size="sm"
    :label="targetCode"
    :aria-label="targetLabel"
    class="shrink-0"
    @click="toggleLocale"
  />
</template>
