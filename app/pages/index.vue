<script setup lang="ts">
import { api } from '#convex/api'

const { t } = useI18n()
const { data: overview, status, error } = await useConvexQuery(api.dashboard.overview, {})

const stats = computed(() => overview.value?.stats)

const cards = computed(() => [
  {
    label: t('overview.cards.employees'),
    icon: 'i-lucide-users',
    value: stats.value?.employees ?? 0,
    description: t('overview.cards.employeesDescription'),
    to: '/employees'
  },
  {
    label: t('overview.cards.resources'),
    icon: 'i-lucide-server',
    value: stats.value?.resources ?? 0,
    description: t('overview.cards.resourcesDescription'),
    to: '/resources'
  },
  {
    label: t('overview.cards.permissions'),
    icon: 'i-lucide-shield-check',
    value: stats.value?.permissions ?? 0,
    description: t('overview.cards.permissionsDescription'),
    to: '/permissions'
  },
  {
    label: t('overview.cards.auditEvents'),
    icon: 'i-lucide-history',
    value: stats.value?.auditEvents ?? 0,
    description: t('overview.cards.auditDescription'),
    to: '/audit-log'
  }
])

const quickActions = computed(() => [
  {
    label: t('overview.quickActions.agent'),
    description: t('overview.quickActions.agentDescription'),
    icon: 'i-lucide-sparkles',
    to: '/agent',
    highlight: true
  },
  {
    label: t('overview.quickActions.employees'),
    description: t('overview.quickActions.employeesDescription'),
    icon: 'i-lucide-users',
    to: '/employees'
  },
  {
    label: t('overview.quickActions.resources'),
    description: t('overview.quickActions.resourcesDescription'),
    icon: 'i-lucide-server',
    to: '/resources'
  }
])

const statusColor = {
  success: 'bg-success',
  rejected: 'bg-error',
  pending: 'bg-warning'
} as const

function auditActionLabel(action: string) {
  const key = AUDIT_ACTION_KEYS[action]
  return key ? t(key) : toAuditActionLabel(action)
}

function auditSourceLabel(source: string) {
  return ['admin', 'agent', 'system'].includes(source) ? t(`audit.source.${source}`) : toLabel(source)
}

function auditStatusLabel(eventStatus: string) {
  return ['success', 'rejected', 'pending'].includes(eventStatus) ? t(`audit.status.${eventStatus}`) : toLabel(eventStatus)
}
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar
        :title="t('overview.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('overview.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="t('overview.error')"
      />

      <template v-else>
        <UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-px">
          <UPageCard
            v-for="card in cards"
            :key="card.label"
            :icon="card.icon"
            :title="card.label"
            :to="card.to"
            variant="subtle"
            :ui="{
              container: 'gap-y-1.5',
              wrapper: 'items-start',
              leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
              title: 'font-normal text-muted text-xs uppercase'
            }"
            class="hover:z-1 lg:rounded-none lg:first:rounded-l-lg lg:last:rounded-r-lg"
          >
            <span class="text-3xl font-semibold text-highlighted">
              {{ status === 'pending' ? '…' : card.value }}
            </span>

            <p class="mt-1 text-xs text-dimmed">
              {{ card.description }}
            </p>
          </UPageCard>
        </UPageGrid>

        <div class="mt-6 flex flex-col gap-6 lg:flex-row">
          <UPageCard
            class="lg:flex-1"
            variant="subtle"
            :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'mb-0 border-b border-default p-4' }"
          >
            <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-highlighted">
                    {{ t('overview.recent.title') }}
                  </p>
                  <p class="mt-0.5 text-xs text-dimmed">
                    {{ t('overview.recent.description') }}
                  </p>
                </div>

                <ULink
                  to="/audit-log"
                  class="text-xs font-medium text-muted hover:text-highlighted"
                >
                  {{ t('overview.recent.viewAll') }}
                </ULink>
              </div>
            </template>

            <div
              v-if="!overview?.recentActivity.length"
              class="flex min-h-52 flex-col items-center justify-center px-6 py-8 text-center"
            >
              <div class="mb-3 grid size-10 place-items-center rounded-full bg-elevated">
                <UIcon
                  name="i-lucide-history"
                  class="size-5 text-dimmed"
                />
              </div>

              <p class="text-sm font-medium text-highlighted">
                {{ t('overview.recent.empty') }}
              </p>
              <p class="mt-1 max-w-xs text-xs leading-5 text-dimmed">
                {{ t('overview.recent.emptyDescription') }}
              </p>
            </div>

            <div
              v-else
              class="divide-y divide-default"
            >
              <div
                v-for="event in overview.recentActivity"
                :key="event._id"
                class="flex items-center gap-4 px-4 py-4"
              >
                <div class="grid size-9 shrink-0 place-items-center rounded-full bg-elevated">
                  <div
                    class="size-2 rounded-full"
                    :class="statusColor[event.status]"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ auditActionLabel(event.action) }}
                  </p>
                  <p class="mt-0.5 text-xs capitalize text-dimmed">
                    {{ auditSourceLabel(event.source) }} · {{ auditStatusLabel(event.status) }}
                  </p>
                </div>
              </div>
            </div>
          </UPageCard>

          <UPageCard
            class="lg:w-96 lg:shrink-0"
            variant="subtle"
          >
            <template #header>
              <p class="text-sm font-semibold text-highlighted">
                {{ t('overview.quickActions.title') }}
              </p>
              <p class="mt-1 text-xs text-dimmed">
                {{ t('overview.quickActions.description') }}
              </p>
            </template>

            <div class="grid gap-2">
              <ULink
                v-for="action in quickActions"
                :key="action.label"
                :to="action.to"
                class="group flex items-center gap-3 rounded-lg border border-default p-3 transition hover:border-accented hover:bg-elevated/50"
              >
                <div
                  class="grid size-9 shrink-0 place-items-center rounded-lg"
                  :class="action.highlight ? 'bg-inverted text-inverted' : 'bg-elevated text-muted'"
                >
                  <UIcon
                    :name="action.icon"
                    class="size-4"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted">
                    {{ action.label }}
                  </p>
                  <p class="text-xs text-dimmed">
                    {{ action.description }}
                  </p>
                </div>

                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-dimmed transition group-hover:translate-x-0.5"
                />
              </ULink>
            </div>
          </UPageCard>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
