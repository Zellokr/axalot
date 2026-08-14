<script setup lang="ts">
import { api } from '#convex/api'

const { data: overview, status, error } = await useConvexQuery(api.dashboard.overview, {})

const stats = computed(() => overview.value?.stats)

const cards = computed(() => [
  {
    label: 'Employees',
    icon: 'i-lucide-users',
    value: stats.value?.employees ?? 0,
    description: 'People managed by OpsPilot',
    to: '/employees'
  },
  {
    label: 'Resources',
    icon: 'i-lucide-server',
    value: stats.value?.resources ?? 0,
    description: 'Connected company resources',
    to: '/resources'
  },
  {
    label: 'Permissions',
    icon: 'i-lucide-shield-check',
    value: stats.value?.permissions ?? 0,
    description: 'Active resource grants',
    to: '/permissions'
  },
  {
    label: 'Audit events',
    icon: 'i-lucide-history',
    value: stats.value?.auditEvents ?? 0,
    description: 'Recent recorded actions',
    to: '/audit-log'
  }
])

const quickActions = [
  {
    label: 'Ask OpsPilot',
    description: 'Manage access using AI',
    icon: 'i-lucide-sparkles',
    to: '/agent',
    highlight: true
  },
  {
    label: 'Employees',
    description: 'Review employee access',
    icon: 'i-lucide-users',
    to: '/employees'
  },
  {
    label: 'Resources',
    description: 'Manage company systems',
    icon: 'i-lucide-server',
    to: '/resources'
  }
]

const statusColor = {
  success: 'bg-success',
  rejected: 'bg-error',
  pending: 'bg-warning'
} as const
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar
        title="Overview"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          Monitor employees, resources and access across your organization.
        </p>
      </div>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        title="Could not load the overview."
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
                    Recent activity
                  </p>
                  <p class="mt-0.5 text-xs text-dimmed">
                    Latest actions across OpsPilot
                  </p>
                </div>

                <ULink
                  to="/audit-log"
                  class="text-xs font-medium text-muted hover:text-highlighted"
                >
                  View all
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
                No activity yet
              </p>
              <p class="mt-1 max-w-xs text-xs leading-5 text-dimmed">
                Actions performed by administrators and the AI agent will appear here.
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
                    {{ toAuditActionLabel(event.action) }}
                  </p>
                  <p class="mt-0.5 text-xs capitalize text-dimmed">
                    {{ event.source }} · {{ event.status }}
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
                Quick actions
              </p>
              <p class="mt-1 text-xs text-dimmed">
                Common administration tasks
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
