<script setup lang="ts">
import { api } from '#convex/api'
import { AccessLevel, AuditSource } from '../../../convex/helpers/validators'

const route = useRoute()
const toast = useToast()

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

const grantAccess = useConvexMutation(api.permissions.grantAccess)
const revokeAccess = useConvexMutation(api.permissions.revokeAccess)

const revokeTarget = ref<AccessRow | null>(null)

async function changeAccessLevel(item: AccessRow, accessLevel: AccessLevelKey) {
  if (!data.value) return

  try {
    await grantAccess({
      employeeId: data.value.employee._id,
      resourceId: item.resource._id,
      accessLevel: ACCESS_LEVEL_ENUM[accessLevel],
      source: AuditSource.Admin
    })

    toast.add({
      title: item.permission ? 'Access level updated' : 'Access granted',
      description: `${data.value.employee.name} is now "${accessLevel}" on ${item.resource.name}.`,
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: 'Could not update access',
      description: (err as Error).message,
      color: 'error'
    })
  }
}

async function confirmRevoke() {
  if (!data.value || !revokeTarget.value) return

  const item = revokeTarget.value

  try {
    await revokeAccess({
      employeeId: data.value.employee._id,
      resourceId: item.resource._id,
      source: AuditSource.Admin
    })

    toast.add({
      title: 'Access revoked',
      description: `${data.value.employee.name} no longer has access to ${item.resource.name}.`,
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: 'Could not revoke access',
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
        label: `Set to ${toLabel(level)}`,
        icon: 'i-lucide-shield',
        onSelect: () => changeAccessLevel(item, level)
      })),
      [{
        label: 'Revoke access',
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
      label: `Grant as ${toLabel(level)}`,
      icon: 'i-lucide-shield-plus',
      onSelect: () => changeAccessLevel(item, level)
    }))
  ]
}
</script>

<template>
  <UDashboardPanel id="employee-detail">
    <template #header>
      <UDashboardNavbar :title="data?.employee.name ?? 'Employee'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            label="Back"
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
        Employee not found.
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
                :label="toLabel(data.employee.status)"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                icon="i-lucide-shield"
                :label="`${data.activePermissions} / ${data.totalResources} permissions`"
              />
            </div>
          </template>
        </UPageCard>

        <div class="mt-6">
          <h2 class="mb-3 text-sm font-medium text-highlighted">
            Permissions
          </h2>

          <UPageCard
            v-if="!data.access.length"
            variant="subtle"
            description="No resources have been added to the organization yet."
          />

          <UTable
            v-else
            :data="data.access"
            :columns="[
              { accessorKey: 'resource', header: 'Resource' },
              { id: 'type', header: 'Type', cell: ({ row }) => toLabel(row.original.resource.type) },
              { accessorKey: 'permission', header: 'Access level' },
              { id: 'grantedAt', header: 'Granted at' },
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
                  label="Sensitive"
                />
              </div>
            </template>

            <template #permission-cell="{ row }">
              <UBadge
                v-if="row.original.permission"
                color="neutral"
                :variant="accessLevelVariant[row.original.permission.accessLevel]"
                :label="toLabel(row.original.permission.accessLevel)"
              />
              <span
                v-else
                class="text-sm text-dimmed"
              >
                No access
              </span>
            </template>

            <template #grantedAt-cell="{ row }">
              <span :class="row.original.permission ? '' : 'text-dimmed'">
                {{ row.original.permission ? formatDateTime(row.original.permission.grantedAt) : '—' }}
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
                  />
                </UDropdownMenu>
              </div>
            </template>
          </UTable>
        </div>

        <UModal
          :open="!!revokeTarget"
          title="Revoke access"
          :description="`Are you sure you want to revoke ${revokeTarget?.resource.name ?? 'this resource'} access for ${data.employee.name}? This action cannot be undone.`"
          :ui="{ footer: 'justify-end' }"
          @update:open="(value) => { if (!value) revokeTarget = null }"
        >
          <template #footer>
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="revokeTarget = null"
            />
            <UButton
              label="Revoke"
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
