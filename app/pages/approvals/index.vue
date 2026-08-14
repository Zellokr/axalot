<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'
import { api } from '#convex/api'

const UButton = resolveComponent('UButton')

const toast = useToast()
const { t, locale } = useI18n()
const dateLocale = computed(() => locale.value === 'es' ? 'es-ES' : 'en-US')
const { data: approvals, status, error } = await useConvexQuery(api.approvals.list, {})

const approveAccess = useConvexMutation(api.approvals.approve)
const rejectAccess = useConvexMutation(api.approvals.reject)

type ApprovalRow = NonNullable<typeof approvals.value>[number]
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'stale'

const STATUS_COLOR: Record<ApprovalStatus, 'warning' | 'success' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'neutral',
  stale: 'neutral'
}

const search = ref('')
const statusFilter = ref<'all' | ApprovalStatus>('pending')
const statusItems = computed(() => [
  { label: t('common.status.all'), value: 'all' },
  { label: t('approvals.status.pending'), value: 'pending' },
  { label: t('approvals.status.approved'), value: 'approved' },
  { label: t('approvals.status.rejected'), value: 'rejected' },
  { label: t('approvals.status.expired'), value: 'expired' },
  { label: t('approvals.status.stale'), value: 'stale' }
])

function statusLabel(value: ApprovalStatus) {
  return t(`approvals.status.${value}`)
}

function accessLevelLabel(level: 'read' | 'write' | 'admin' | null) {
  return level ? t(`common.accessLevel.${level}`) : t('common.accessLevel.noAccess')
}

function changeLabel(row: ApprovalRow) {
  return t('approvals.changeArrow', {
    from: accessLevelLabel(row.fromLevel),
    to: accessLevelLabel(row.targetLevel)
  })
}

function employeeName(row: ApprovalRow, sentence = false) {
  return row.employee?.name ?? t(sentence ? 'resources.detail.fallbackEmployeeSentence' : 'common.unknown.employee')
}

function resourceName(row: ApprovalRow) {
  return row.resource?.name ?? t('common.unknown.resource')
}

const filteredApprovals = computed(() => {
  return (approvals.value ?? []).filter((approval) => {
    const term = search.value.toLowerCase()
    const matchesSearch
      = !term
        || approval.employee?.name.toLowerCase().includes(term)
        || approval.resource?.name.toLowerCase().includes(term)
    const matchesStatus = statusFilter.value === 'all' || approval.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

const columns = computed<TableColumn<ApprovalRow>[]>(() => [
  {
    accessorKey: 'employee',
    header: t('common.table.employee')
  },
  {
    accessorKey: 'resource',
    header: t('common.table.resource')
  },
  {
    id: 'change',
    header: t('approvals.table.change')
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: t('approvals.table.requested'),
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  },
  {
    accessorKey: 'status',
    header: t('approvals.table.status'),
    filterFn: 'equals'
  },
  { id: 'actions' }
])

const approveTarget = ref<ApprovalRow | null>(null)
const rejectTarget = ref<ApprovalRow | null>(null)

async function confirmApprove() {
  if (!approveTarget.value) return

  const approval = approveTarget.value

  try {
    const result = await approveAccess({ approvalId: approval._id })

    if (result.status === 'expired') {
      toast.add({ title: t('approvals.expired'), color: 'warning' })
      return
    }

    if (result.status === 'stale') {
      toast.add({ title: t('approvals.stale'), color: 'warning' })
      return
    }

    if (result.status === 'policy_denied') {
      toast.add({ title: t('approvals.policyDenied'), color: 'error' })
      return
    }

    toast.add({
      title: t('approvals.toastApproved'),
      description: t('approvals.confirmApprove.description', {
        name: employeeName(approval, true),
        level: accessLevelLabel(approval.targetLevel),
        resource: resourceName(approval)
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('approvals.couldNotApprove'),
      description: (err as Error).message,
      color: 'error'
    })
  } finally {
    approveTarget.value = null
  }
}

async function confirmReject() {
  if (!rejectTarget.value) return

  const approval = rejectTarget.value

  try {
    const result = await rejectAccess({ approvalId: approval._id })

    if (result.status === 'expired') {
      toast.add({ title: t('approvals.expired'), color: 'warning' })
      return
    }

    toast.add({
      title: t('approvals.toastRejected'),
      color: 'neutral'
    })
  } catch (err) {
    toast.add({
      title: t('approvals.couldNotReject'),
      description: (err as Error).message,
      color: 'error'
    })
  } finally {
    rejectTarget.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="approvals">
    <template #header>
      <UDashboardNavbar
        :title="t('approvals.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('approvals.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          :placeholder="t('approvals.filterSearch')"
        />

        <USelect
          v-model="statusFilter"
          :items="statusItems"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
          :placeholder="t('approvals.filterStatus')"
          class="min-w-40"
        />
      </div>

      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        {{ t('approvals.loading') }}
      </p>

      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <template v-else>
        <UTable
          :data="filteredApprovals"
          :columns="columns"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }"
        >
          <template #employee-cell="{ row }">
            <div class="flex items-center gap-3">
              <UAvatar
                :alt="employeeName(row.original)"
                size="sm"
              />

              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ employeeName(row.original) }}
                </p>
                <p
                  v-if="row.original.employee"
                  class="truncate text-xs text-muted"
                >
                  {{ row.original.employee.email }}
                </p>
              </div>
            </div>
          </template>

          <template #resource-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium text-highlighted">{{ resourceName(row.original) }}</span>
              <UBadge
                v-if="row.original.resource?.sensitive"
                color="warning"
                variant="subtle"
                :label="t('common.resourceSensitivity.sensitive')"
              />
            </div>
          </template>

          <template #change-cell="{ row }">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="changeLabel(row.original)"
            />
          </template>

          <template #createdAt-cell="{ row }">
            <div>
              <p class="text-sm text-default">
                {{ formatDateTime(row.original.createdAt, dateLocale) }}
              </p>
              <p class="text-xs text-dimmed">
                {{ t('audit.source.' + row.original.requestedSource) }}
              </p>
            </div>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="STATUS_COLOR[row.original.status]"
              variant="subtle"
              :label="statusLabel(row.original.status)"
            />
          </template>

          <template #actions-cell="{ row }">
            <div
              v-if="row.original.status === 'pending'"
              class="flex justify-end gap-1"
            >
              <UButton
                icon="i-lucide-check"
                color="success"
                variant="ghost"
                :aria-label="t('common.actions.approve')"
                @click="approveTarget = row.original"
              />
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                :aria-label="t('common.actions.reject')"
                @click="rejectTarget = row.original"
              />
            </div>
          </template>
        </UTable>

        <div
          v-if="!filteredApprovals.length && approvals?.length"
          class="py-12 text-center text-muted"
        >
          {{ t('approvals.noResults') }}
        </div>

        <div
          v-else-if="!approvals?.length"
          class="py-16 text-center"
        >
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
            <UIcon
              name="i-lucide-clipboard-check"
              class="size-5 text-dimmed"
            />
          </div>

          <p class="text-sm font-medium text-highlighted">
            {{ t('approvals.empty') }}
          </p>
          <p class="mt-1 text-sm text-dimmed">
            {{ t('approvals.emptyDescription') }}
          </p>
        </div>
      </template>

      <UModal
        :open="!!approveTarget"
        :title="t('approvals.confirmApprove.title')"
        :description="approveTarget ? t('approvals.confirmApprove.description', {
          name: employeeName(approveTarget),
          level: accessLevelLabel(approveTarget.targetLevel),
          resource: resourceName(approveTarget)
        }) : ''"
        :ui="{ footer: 'justify-end' }"
        @update:open="(value) => { if (!value) approveTarget = null }"
      >
        <template #footer>
          <UButton
            :label="t('common.actions.cancel')"
            color="neutral"
            variant="outline"
            @click="approveTarget = null"
          />
          <UButton
            :label="t('common.actions.approve')"
            color="success"
            :loading="approveAccess.pending.value"
            @click="confirmApprove"
          />
        </template>
      </UModal>

      <UModal
        :open="!!rejectTarget"
        :title="t('approvals.confirmReject.title')"
        :description="rejectTarget ? t('approvals.confirmReject.description', {
          name: employeeName(rejectTarget),
          resource: resourceName(rejectTarget)
        }) : ''"
        :ui="{ footer: 'justify-end' }"
        @update:open="(value) => { if (!value) rejectTarget = null }"
      >
        <template #footer>
          <UButton
            :label="t('common.actions.cancel')"
            color="neutral"
            variant="outline"
            @click="rejectTarget = null"
          />
          <UButton
            :label="t('common.actions.reject')"
            color="error"
            :loading="rejectAccess.pending.value"
            @click="confirmReject"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
