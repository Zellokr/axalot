<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const items = computed<NavigationMenuItem[]>(() => [
  {
    label: t('navigation.home'),
    icon: 'i-lucide-home',
    to: '/home'
  },
  {
    label: t('navigation.overview'),
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    label: t('navigation.employees'),
    icon: 'i-lucide-users',
    to: '/employees'
  },
  {
    label: t('navigation.agent'),
    icon: 'i-lucide-bot',
    to: '/agent'
  },
  {
    label: t('navigation.resources'),
    icon: 'i-lucide-server',
    to: '/resources'
  },
  {
    label: t('navigation.permissions'),
    icon: 'i-lucide-shield-check',
    to: '/permissions'
  },
  {
    label: t('navigation.approvals'),
    icon: 'i-lucide-clipboard-check',
    to: '/approvals'
  },
  {
    label: t('navigation.policies'),
    icon: 'i-lucide-gavel',
    to: '/policies'
  },
  {
    label: t('navigation.auditLog'),
    icon: 'i-lucide-history',
    to: '/audit-log'
  },
  {
    label: t('navigation.learn'),
    icon: 'i-lucide-book-open',
    to: '/learn',
    ui: { item: 'border-t border-default pt-2 mt-2' }
  }
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      resizable
    >
      <template #header="{ collapsed }">
        <span
          class="font-semibold text-highlighted"
          :class="collapsed ? 'w-full text-center' : 'px-1'"
        >
          {{ collapsed ? "A" : "Axalot" }}
        </span>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
        />
      </template>
    </UDashboardSidebar>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <header class="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-default bg-default px-4 sm:px-6">
        <AppLanguageButton />
        <UColorModeButton />
      </header>

      <main class="flex min-h-0 flex-1 overflow-hidden [&>[data-slot=root]]:min-h-0">
        <slot />
      </main>
    </div>
  </UDashboardGroup>
</template>
