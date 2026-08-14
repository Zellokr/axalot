<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Learn',
    icon: 'i-lucide-book-open',
    to: '/learn'
  },
  {
    label: 'Overview',
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    label: 'Employees',
    icon: 'i-lucide-users',
    to: '/employees'
  },
  {
    label: 'Agent',
    icon: 'i-lucide-bot',
    to: '/agent'
  },
  {
    label: 'Resources',
    icon: 'i-lucide-server',
    to: '/resources'
  },
  {
    label: 'Permissions',
    icon: 'i-lucide-shield-check',
    to: '/permissions'
  },
  {
    label: 'Policies',
    icon: 'i-lucide-gavel',
    to: '/policies'
  },
  {
    label: 'Audit Log',
    icon: 'i-lucide-history',
    to: '/audit-log'
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

      <template #footer>
        <UColorModeButton />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
