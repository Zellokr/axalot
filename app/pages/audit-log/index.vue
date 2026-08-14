<script setup lang="ts">
import { api } from '#convex/api'

const { t, locale } = useI18n()
const dateLocale = computed(() => locale.value === 'es' ? 'es-ES' : 'en-US')
const { data: logs, status, error } = await useConvexQuery(api.auditLogs.list, {})

type AuditLogRow = NonNullable<typeof logs.value>[number]
type EventColor = 'success' | 'info' | 'warning' | 'error' | 'neutral'

// Icon/color are keyed by the exact `action` string each backend mutation records
// (convex/model/permissions.ts, model/approvals.ts, approvals.ts, actionProposals.ts,
// model/policies.ts, axalotAgent.ts). Anything not listed here — including future
// action kinds — still gets a sensible color via inferColorFromAction() instead of
// silently rendering as a false "granted".
const EVENT_COLORS: Record<string, EventColor> = {
  access_granted: 'success',
  access_upgraded: 'info',
  access_downgraded: 'warning',
  access_revoked: 'error',
  access_unchanged: 'neutral',
  access_policy_denied: 'error',
  approval_created: 'info',
  approval_reused: 'info',
  approval_approved: 'success',
  approval_rejected: 'error',
  approval_expired: 'warning',
  approval_stale: 'warning',
  approval_policy_changed: 'warning',
  proposal_created: 'info',
  proposal_executed: 'success',
  proposal_cancelled: 'neutral',
  proposal_expired: 'warning',
  proposal_stale: 'warning',
  proposal_invalidated: 'warning',
  proposal_policy_denied: 'error',
  proposal_policy_changed: 'warning',
  policy_activated: 'success',
  policy_deactivated: 'neutral',
  agent_conversation_cleared: 'neutral'
}

const EVENT_ICONS: Record<string, string> = {
  access_granted: 'i-lucide-check',
  access_upgraded: 'i-lucide-arrow-up',
  access_downgraded: 'i-lucide-arrow-down',
  access_revoked: 'i-lucide-x',
  access_unchanged: 'i-lucide-minus',
  access_policy_denied: 'i-lucide-shield-x',
  approval_created: 'i-lucide-clock',
  approval_reused: 'i-lucide-clock',
  approval_approved: 'i-lucide-check-check',
  approval_rejected: 'i-lucide-shield-x',
  approval_expired: 'i-lucide-triangle-alert',
  approval_stale: 'i-lucide-refresh-cw',
  approval_policy_changed: 'i-lucide-triangle-alert',
  proposal_created: 'i-lucide-message-square',
  proposal_executed: 'i-lucide-check-check',
  proposal_cancelled: 'i-lucide-x',
  proposal_expired: 'i-lucide-triangle-alert',
  proposal_stale: 'i-lucide-refresh-cw',
  proposal_invalidated: 'i-lucide-triangle-alert',
  proposal_policy_denied: 'i-lucide-shield-x',
  proposal_policy_changed: 'i-lucide-triangle-alert',
  policy_activated: 'i-lucide-gavel',
  policy_deactivated: 'i-lucide-gavel',
  agent_conversation_cleared: 'i-lucide-trash-2'
}

const COLOR_CLASSES: Record<EventColor, { iconBg: string, iconText: string, rowBorder: string }> = {
  success: { iconBg: 'bg-success/10', iconText: 'text-success', rowBorder: 'border-l-2 border-l-success' },
  info: { iconBg: 'bg-info/10', iconText: 'text-info', rowBorder: 'border-l-2 border-l-info' },
  warning: { iconBg: 'bg-warning/10', iconText: 'text-warning', rowBorder: 'border-l-2 border-l-warning' },
  error: { iconBg: 'bg-error/10', iconText: 'text-error', rowBorder: 'border-l-2 border-l-error' },
  neutral: { iconBg: 'bg-elevated', iconText: 'text-dimmed', rowBorder: 'border-l-2 border-l-default' }
}

const STATUS_BADGE: Record<string, { color: 'success' | 'error' | 'warning' }> = {
  success: { color: 'success' },
  rejected: { color: 'error' },
  pending: { color: 'warning' }
}

function inferColorFromAction(action: string): EventColor {
  if (/denied|revoked|rejected/i.test(action)) return 'error'
  if (/expired|stale|invalidated|cancelled|downgraded/i.test(action)) return 'warning'
  if (/approved|granted|created|executed|activated|upgraded/i.test(action)) return 'success'
  if (/unchanged|cleared|deactivated|reused/i.test(action)) return 'neutral'
  return 'info'
}

function eventVisual(log: AuditLogRow) {
  const isLegacyGrant = log.action.startsWith('Granted')
  const isLegacyRevoke = log.action.startsWith('Revoked')

  const color = isLegacyGrant
    ? 'success'
    : isLegacyRevoke
      ? 'error'
      : (EVENT_COLORS[log.action] ?? inferColorFromAction(log.action))
  const icon = isLegacyGrant
    ? 'i-lucide-check'
    : isLegacyRevoke
      ? 'i-lucide-x'
      : (EVENT_ICONS[log.action] ?? 'i-lucide-circle-dot')
  const statusBadge = STATUS_BADGE[log.status] ?? { color: 'warning' as const }
  const actionKey = AUDIT_ACTION_KEYS[log.action]
  const title = actionKey ? t(actionKey) : toAuditActionLabel(log.action)
  const statusLabel = ['success', 'rejected', 'pending'].includes(log.status)
    ? t(`audit.status.${log.status}`)
    : toLabel(log.status)

  return { ...COLOR_CLASSES[color], title, icon, statusBadge: { ...statusBadge, label: statusLabel } }
}

function accessLevelLabel(value: unknown) {
  const level = String(value)
  return ['read', 'write', 'admin'].includes(level) ? t(`common.accessLevel.${level}`) : level
}

function sourceLabel(source: string) {
  return ['admin', 'agent', 'system'].includes(source) ? t(`audit.source.${source}`) : toLabel(source)
}

function accessDisplay(log: AuditLogRow): string {
  const metadata = (log.metadata ?? {}) as Record<string, unknown>
  const from = metadata.fromLevel ?? metadata.previousAccessLevel ?? metadata.currentLevel
  const to = metadata.targetLevel ?? metadata.accessLevel ?? metadata.revokedAccessLevel

  if (from && to && from !== to) return `${accessLevelLabel(from)} → ${accessLevelLabel(to)}`
  if (to) return accessLevelLabel(to)
  if (from) return accessLevelLabel(from)
  return '—'
}
</script>

<template>
  <UDashboardPanel id="audit-log">
    <template #header>
      <UDashboardNavbar
        :title="t('audit.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('audit.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        {{ t('audit.loading') }}
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
              header: t('audit.table.action'),
              meta: { class: { td: (cell) => eventVisual(cell.row.original).rowBorder } }
            },
            { id: 'employee', header: t('common.table.employee') },
            { id: 'resource', header: t('common.table.resource') },
            { id: 'access', header: t('audit.table.access') },
            { accessorKey: 'createdAt', header: t('audit.table.date') }
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
                :class="eventVisual(row.original).iconBg"
              >
                <UIcon
                  :name="eventVisual(row.original).icon"
                  class="size-4"
                  :class="eventVisual(row.original).iconText"
                />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-highlighted">{{ eventVisual(row.original).title }}</span>
                  <UBadge
                    :color="eventVisual(row.original).statusBadge.color"
                    variant="subtle"
                    :label="eventVisual(row.original).statusBadge.label"
                  />
                </div>

                <div class="mt-1 flex items-center gap-2">
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    :label="sourceLabel(row.original.source)"
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
            <span class="text-sm text-muted">{{ formatDateTime(row.original.createdAt, dateLocale) }}</span>
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
            {{ t('audit.empty') }}
          </p>
          <p class="mt-1 text-sm text-dimmed">
            {{ t('audit.emptyDescription') }}
          </p>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
