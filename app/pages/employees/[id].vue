<script setup lang="ts">
import { api } from '#convex/api'
import { AccessLevel } from '../../../convex/helpers/validators'

const route = useRoute()
const toast = useToast()
const { t, locale } = useI18n()
const dateLocale = computed(() => locale.value === 'es' ? 'es-ES' : 'en-US')

const { data, status, error } = await useConvexQuery(api.employees.getDetails, {
  employeeId: route.params.id as string
})

const accessLevelVariant = {
  read: 'outline',
  write: 'subtle',
  admin: 'solid'
} as const

type AccessLevelKey = keyof typeof accessLevelVariant
type AccessRow = NonNullable<typeof data.value>['access'][number]

const ACCESS_LEVELS: AccessLevelKey[] = ['read', 'write', 'admin']

const ACCESS_LEVEL_ENUM: Record<AccessLevelKey, AccessLevel> = {
  read: AccessLevel.Read,
  write: AccessLevel.Write,
  admin: AccessLevel.Admin
}

const setAccessLevel = useConvexMutation(api.permissions.setAccessLevel)
const revokeAccess = useConvexMutation(api.permissions.revokeAccess)

const revokeTarget = ref<AccessRow | null>(null)

function accessLevelLabel(level: AccessLevelKey) {
  return t(`common.accessLevel.${level}`)
}

async function changeAccessLevel(item: AccessRow, accessLevel: AccessLevelKey) {
  if (!data.value) return

  try {
    const result = await setAccessLevel({
      employeeId: data.value.employee._id,
      resourceId: item.resource._id,
      targetLevel: ACCESS_LEVEL_ENUM[accessLevel]
    })

    if (result.status === 'policy_denied') {
      toast.add({
        title: t('employees.detail.denied'),
        description: result.policy.reason,
        color: 'error'
      })
      return
    }

    if (result.status === 'approval_required') {
      toast.add({
        title: t('employees.detail.approvalRequested'),
        description: t('employees.detail.approvalRequestedDescription', { name: data.value.employee.name }),
        color: 'warning'
      })
      return
    }

    if (result.status === 'unchanged') {
      toast.add({
        title: t('employees.detail.noChange'),
        description: t('employees.detail.noChangeDescription', {
          name: data.value.employee.name,
          level: accessLevelLabel(accessLevel),
          resource: item.resource.name
        }),
        color: 'neutral'
      })
      return
    }

    toast.add({
      title: t(item.permission ? 'employees.detail.accessLevelUpdated' : 'employees.detail.accessGranted'),
      description: t('employees.detail.updatedDescription', {
        name: data.value.employee.name,
        level: accessLevelLabel(accessLevel),
        resource: item.resource.name
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('employees.detail.couldNotUpdate'),
      description: (err as Error).message,
      color: 'error'
    })
  }
}

async function confirmRevoke() {
  if (!data.value || !revokeTarget.value) return

  const item = revokeTarget.value

  try {
    const result = await revokeAccess({
      employeeId: data.value.employee._id,
      resourceId: item.resource._id
    })

    if (result.status === 'policy_denied') {
      toast.add({
        title: t('employees.detail.revocationDenied'),
        description: result.policy.reason,
        color: 'error'
      })
      return
    }

    if (result.status === 'approval_required') {
      toast.add({
        title: t('employees.detail.approvalRequested'),
        description: t('employees.detail.revokeApprovalDescription', { name: data.value.employee.name }),
        color: 'warning'
      })
      return
    }

    toast.add({
      title: t('employees.detail.revoked'),
      description: t('employees.detail.revokedDescription', {
        name: data.value.employee.name,
        resource: item.resource.name
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('employees.detail.couldNotRevoke'),
      description: (err as Error).message,
      color: 'error'
    })
  } finally {
    revokeTarget.value = null
  }
}

function getRowActions(item: AccessRow) {
  if (item.permission) {
    const currentLevel = item.permission.accessLevel

    return [
      ACCESS_LEVELS.filter(level => level !== currentLevel).map(level => ({
        label: t('employees.detail.setTo', { level: accessLevelLabel(level) }),
        icon: 'i-lucide-shield',
        onSelect: () => changeAccessLevel(item, level)
      })),
      [{
        label: t('employees.detail.revokeAccess'),
        icon: 'i-lucide-trash',
        color: 'error' as const,
        onSelect: () => {
          revokeTarget.value = item
        }
      }]
    ]
  }

  return [
    ACCESS_LEVELS.map(level => ({
      label: t('employees.detail.grantAs', { level: accessLevelLabel(level) }),
      icon: 'i-lucide-shield-plus',
      onSelect: () => changeAccessLevel(item, level)
    }))
  ]
}
</script>

<template>
  <UDashboardPanel id="employee-detail">
    <template #header>
      <UDashboardNavbar :title="data?.employee.name ?? t('employees.detail.fallbackName')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            :label="t('common.actions.back')"
            color="neutral"
            variant="ghost"
            to="/employees"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <div
        v-else-if="status === 'success' && !data"
        class="py-12 text-center text-muted"
      >
        {{ t('employees.detail.notFound') }}
      </div>

      <template v-else-if="data">
        <UPageCard
          :title="data.employee.name"
          :description="data.employee.email"
          variant="subtle"
          :ui="{ title: 'text-lg', leading: 'mb-0' }"
        >
          <template #leading>
            <UAvatar
              :alt="data.employee.name"
              size="xl"
            />
          </template>

          <template #footer>
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                color="neutral"
                variant="subtle"
                :label="toLabel(data.employee.role)"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                :label="toLabel(data.employee.level)"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                :label="toLabel(data.employee.department)"
              />
              <UBadge
                :color="data.employee.status === 'active' ? 'success' : 'neutral'"
                variant="subtle"
                :label="data.employee.status === 'active' || data.employee.status === 'inactive' ? t(`common.status.${data.employee.status}`) : toLabel(data.employee.status)"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                icon="i-lucide-shield"
                :label="t('employees.detail.permissionsCount', { active: data.activePermissions, total: data.totalResources })"
              />
            </div>
          </template>
        </UPageCard>

        <div class="mt-6">
          <h2 class="mb-3 text-sm font-medium text-highlighted">
            {{ t('permissions.title') }}
          </h2>

          <UPageCard
            v-if="!data.access.length"
            variant="subtle"
            :description="t('employees.detail.noResources')"
          />

          <UTable
            v-else
            :data="data.access"
            :columns="[
              { accessorKey: 'resource', header: t('common.table.resource') },
              { id: 'type', header: t('common.table.type'), cell: ({ row }) => t(`common.resourceType.${row.original.resource.type}`) },
              { accessorKey: 'permission', header: t('common.table.accessLevel') },
              { id: 'grantedAt', header: t('common.table.grantedAt') },
              { id: 'actions' }
            ]"
          >
            <template #resource-cell="{ row }">
              <div class="flex items-center gap-2">
                <span class="font-medium text-highlighted">{{ row.original.resource.name }}</span>
                <UBadge
                  v-if="row.original.resource.sensitive"
                  color="warning"
                  variant="subtle"
                  :label="t('common.resourceSensitivity.sensitive')"
                />
              </div>
            </template>

            <template #permission-cell="{ row }">
              <UBadge
                v-if="row.original.permission"
                color="neutral"
                :variant="accessLevelVariant[row.original.permission.accessLevel]"
                :label="accessLevelLabel(row.original.permission.accessLevel)"
              />
              <span
                v-else
                class="text-sm text-dimmed"
              >
                {{ t('common.accessLevel.noAccess') }}
              </span>
            </template>

            <template #grantedAt-cell="{ row }">
              <span :class="row.original.permission ? '' : 'text-dimmed'">
                {{ row.original.permission ? formatDateTime(row.original.permission.grantedAt, dateLocale) : '—' }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="text-right">
                <UDropdownMenu
                  :items="getRowActions(row.original)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    icon="i-lucide-ellipsis-vertical"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('common.aria.accessActions')"
                  />
                </UDropdownMenu>
              </div>
            </template>
          </UTable>
        </div>

        <UModal
          :open="!!revokeTarget"
          :title="t('employees.detail.revokeAccess')"
          :description="t('employees.detail.revokeDescription', { resource: revokeTarget?.resource.name ?? t('employees.detail.revokeFallbackResource'), name: data.employee.name })"
          :ui="{ footer: 'justify-end' }"
          @update:open="(value) => { if (!value) revokeTarget = null }"
        >
          <template #footer>
            <UButton
              :label="t('common.actions.cancel')"
              color="neutral"
              variant="outline"
              @click="revokeTarget = null"
            />
            <UButton
              :label="t('common.actions.revoke')"
              color="error"
              :loading="revokeAccess.pending.value"
              @click="confirmRevoke"
            />
          </template>
        </UModal>
      </template>
    </template>
  </UDashboardPanel>
</template>
