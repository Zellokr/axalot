<script setup lang="ts">
import { api } from '#convex/api'

const { data: logs, status, error } = await useConvexQuery(api.auditLogs.list, {})

type AuditLogRow = NonNullable<typeof logs.value>[number]
type EventKind = 'granted' | 'updated' | 'revoked'

const EVENT_META: Record<EventKind, {
  title: string
  badge: string
  color: 'success' | 'info' | 'error'
  icon: string
  iconBg: string
  iconText: string
  rowBorder: string
}> = {
  granted: {
    title: 'Access granted',
    badge: 'Granted',
    color: 'success',
    icon: 'i-lucide-check',
    iconBg: 'bg-success/10',
    iconText: 'text-success',
    rowBorder: 'border-l-2 border-l-success'
  },
  updated: {
    title: 'Access updated',
    badge: 'Updated',
    color: 'info',
    icon: 'i-lucide-refresh-cw',
    iconBg: 'bg-info/10',
    iconText: 'text-info',
    rowBorder: 'border-l-2 border-l-info'
  },
  revoked: {
    title: 'Access revoked',
    badge: 'Revoked',
    color: 'error',
    icon: 'i-lucide-x',
    iconBg: 'bg-error/10',
    iconText: 'text-error',
    rowBorder: 'border-l-2 border-l-error'
  }
}

function eventKind(log: AuditLogRow): EventKind {
  if (log.action.startsWith('Revoked')) return 'revoked'
  if (log.metadata?.previousAccessLevel) return 'updated'
  return 'granted'
}

function accessDisplay(log: AuditLogRow): string {
  if (log.metadata?.previousAccessLevel) {
    return `${log.metadata.previousAccessLevel} → ${log.metadata.accessLevel}`
  }
  if (log.metadata?.revokedAccessLevel) {
    return log.metadata.revokedAccessLevel
  }
  if (log.metadata?.accessLevel) {
    return log.metadata.accessLevel
  }
  return '—'
}
</script>

<template>
  <UDashboardPanel id="audit-log">
    <template #header>
      <UDashboardNavbar
        title="Audit Log"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          Every action recorded by administrators and the AI agent.
        </p>
      </div>
    </template>

    <template #body>
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        Loading audit log...
      </p>

      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <template v-else>
        <UTable
          :data="logs ?? []"
          :columns="[
            {
              accessorKey: 'action',
              header: 'Action',
              meta: { class: { td: (cell) => EVENT_META[eventKind(cell.row.original)].rowBorder } }
            },
            { id: 'employee', header: 'Employee' },
            { id: 'resource', header: 'Resource' },
            { id: 'access', header: 'Access' },
            { accessorKey: 'createdAt', header: 'Date' }
          ]"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }"
        >
          <template #action-cell="{ row }">
            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                :class="EVENT_META[eventKind(row.original)].iconBg"
              >
                <UIcon
                  :name="EVENT_META[eventKind(row.original)].icon"
                  class="size-4"
                  :class="EVENT_META[eventKind(row.original)].iconText"
                />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-highlighted">{{ EVENT_META[eventKind(row.original)].title }}</span>
                  <UBadge
                    :color="EVENT_META[eventKind(row.original)].color"
                    variant="subtle"
                    :label="EVENT_META[eventKind(row.original)].badge"
                  />
                </div>

                <div class="mt-1 flex items-center gap-2">
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    :label="toLabel(row.original.source)"
                  />
                </div>
              </div>
            </div>
          </template>

          <template #employee-cell="{ row }">
            <span :class="row.original.employee ? 'text-default' : 'text-dimmed'">
              {{ row.original.employee?.name ?? '—' }}
            </span>
          </template>

          <template #resource-cell="{ row }">
            <span :class="row.original.resource ? 'text-default' : 'text-dimmed'">
              {{ row.original.resource?.name ?? '—' }}
            </span>
          </template>

          <template #access-cell="{ row }">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="accessDisplay(row.original)"
            />
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatDateTime(row.original.createdAt) }}</span>
          </template>
        </UTable>

        <div
          v-if="!logs?.length"
          class="py-16 text-center"
        >
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
            <UIcon
              name="i-lucide-history"
              class="size-5 text-dimmed"
            />
          </div>

          <p class="text-sm font-medium text-highlighted">
            No activity yet
          </p>
          <p class="mt-1 text-sm text-dimmed">
            Actions performed by administrators and the AI agent will appear here.
          </p>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
