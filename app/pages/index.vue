<script setup lang="ts">
const { t } = useI18n()

const PANELS = computed(() => [
  {
    to: '/overview',
    icon: 'i-lucide-layout-dashboard',
    title: t('navigation.overview'),
    description: t('overview.description')
  },
  {
    to: '/employees',
    icon: 'i-lucide-users',
    title: t('navigation.employees'),
    description: t('employees.description')
  },
  {
    to: '/agent',
    icon: 'i-lucide-bot',
    title: t('navigation.agent'),
    description: t('agent.description')
  },
  {
    to: '/resources',
    icon: 'i-lucide-server',
    title: t('navigation.resources'),
    description: t('resources.description')
  },
  {
    to: '/permissions',
    icon: 'i-lucide-shield-check',
    title: t('navigation.permissions'),
    description: t('permissions.description')
  },
  {
    to: '/approvals',
    icon: 'i-lucide-clipboard-check',
    title: t('navigation.approvals'),
    description: t('approvals.description')
  },
  {
    to: '/policies',
    icon: 'i-lucide-gavel',
    title: t('navigation.policies'),
    description: t('policies.description')
  },
  {
    to: '/audit-log',
    icon: 'i-lucide-history',
    title: t('navigation.auditLog'),
    description: t('audit.description')
  },
  {
    to: '/learn',
    icon: 'i-lucide-book-open',
    title: t('navigation.learn'),
    description: t('learn.description')
  }
])
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar
        :title="t('home.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('home.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <div class="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 class="text-xl font-semibold text-highlighted">
            Axalot
          </h1>
          <p class="mt-2 text-sm leading-6 text-muted">
            {{ t('learn.intro') }}
          </p>
        </div>

        <UPageGrid class="gap-4 sm:grid-cols-2">
          <UPageCard
            v-for="panel in PANELS"
            :key="panel.to"
            :icon="panel.icon"
            :title="panel.title"
            :description="panel.description"
            :to="panel.to"
            variant="subtle"
            :ui="{ wrapper: 'items-stretch' }"
          />
        </UPageGrid>
      </div>
    </template>
  </UDashboardPanel>
</template>
