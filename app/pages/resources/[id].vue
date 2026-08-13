<script setup lang="ts">
import { api } from '#convex/api'
import { AccessLevel, AuditSource } from '../../../convex/helpers/validators'

const route = useRoute()
const toast = useToast()

const { data, status, error } = await useConvexQuery(api.resources.getDetails, {
  resourceId: route.params.id as string
})

function getResourceLetter(name: string) {
  return name.charAt(0).toUpperCase()
}

const accessLevelVariant = {
  read: 'outline',
  write: 'subtle',
  admin: 'solid'
} as const

type AccessLevelKey = keyof typeof accessLevelVariant
type PermissionRow = NonNullable<typeof data.value>['permissions'][number]

const ACCESS_LEVELS: AccessLevelKey[] = ['read', 'write', 'admin']

const ACCESS_LEVEL_ENUM: Record<AccessLevelKey, AccessLevel> = {
  read: AccessLevel.Read,
  write: AccessLevel.Write,
  admin: AccessLevel.Admin
}

const grantAccess = useConvexMutation(api.permissions.grantAccess)
const revokeAccess = useConvexMutation(api.permissions.revokeAccess)

const revokeTarget = ref<PermissionRow | null>(null)

async function changeAccessLevel(permission: PermissionRow, accessLevel: AccessLevelKey) {
  if (!data.value) return

  try {
    await grantAccess({
      employeeId: permission.employeeId,
      resourceId: data.value.resource._id,
      accessLevel: ACCESS_LEVEL_ENUM[accessLevel],
      source: AuditSource.Admin
    })

    toast.add({
      title: 'Access level updated',
      description: `${permission.employee?.name ?? 'This employee'} is now "${accessLevel}" on ${data.value.resource.name}.`,
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

  const permission = revokeTarget.value

  try {
    await revokeAccess({
      employeeId: permission.employeeId,
      resourceId: data.value.resource._id,
      source: AuditSource.Admin
    })

    toast.add({
      title: 'Access revoked',
      description: `${permission.employee?.name ?? 'This employee'} no longer has access to ${data.value.resource.name}.`,
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

function getRowActions(permission: PermissionRow) {
  return [
    ACCESS_LEVELS.filter(level => level !== permission.accessLevel).map(level => ({
      label: `Set to ${toLabel(level)}`,
      icon: 'i-lucide-shield',
      onSelect: () => changeAccessLevel(permission, level)
    })),
    [{
      label: 'Revoke access',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      onSelect: () => {
        revokeTarget.value = permission
      }
    }]
  ]
}
</script>

<template>
  <UDashboardPanel id="resource-detail">
    <template #header>
      <UDashboardNavbar :title="data?.resource.name ?? 'Resource'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            label="Back"
            color="neutral"
            variant="ghost"
            to="/resources"
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
        Resource not found.
      </div>

      <template v-else-if="data">
        <UCard
          variant="subtle"
          :ui="{ body: 'p-5' }"
        >
          <div class="flex items-start gap-4">
            <div class="grid size-11 shrink-0 place-items-center rounded-xl bg-elevated font-semibold text-toned">
              {{ getResourceLetter(data.resource.name) }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-lg font-semibold text-highlighted">
                    {{ data.resource.name }}
                  </h2>

                  <p class="mt-1 text-sm text-muted">
                    {{ data.resource.slug }} · {{ toLabel(data.resource.type) }}
                  </p>
                </div>

                <UBadge
                  v-if="data.resource.sensitive"
                  color="warning"
                  variant="subtle"
                  class="gap-1.5"
                >
                  <span class="size-1.5 rounded-full bg-warning" />
                  Sensitive
                </UBadge>

                <UBadge
                  v-else
                  color="neutral"
                  variant="subtle"
                  label="Standard"
                />
              </div>
            </div>
          </div>
        </UCard>

        <div class="mt-6">
          <h2 class="mb-3 text-sm font-medium text-highlighted">
            Permissions
          </h2>

          <UCard
            v-if="!data.permissions.length"
            variant="subtle"
          >
            <div class="py-8 text-center">
              <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
                <UIcon
                  name="i-lucide-shield"
                  class="size-5 text-dimmed"
                />
              </div>

              <p class="text-sm font-medium text-highlighted">
                No permissions yet
              </p>
              <p class="mt-1 text-sm text-dimmed">
                No employee has been granted access to this resource yet.
              </p>
            </div>
          </UCard>

          <UTable
            v-else
            :data="data.permissions"
            :columns="[
              { accessorKey: 'employee', header: 'Employee' },
              { accessorKey: 'accessLevel', header: 'Access level' },
              { accessorKey: 'grantedAt', header: 'Granted at' },
              { id: 'actions' }
            ]"
          >
            <template #employee-cell="{ row }">
              <div>
                <p class="font-medium text-highlighted">
                  {{ row.original.employee?.name ?? 'Unknown employee' }}
                </p>
                <p
                  v-if="row.original.employee"
                  class="text-xs text-muted"
                >
                  {{ row.original.employee.email }}
                </p>
              </div>
            </template>

            <template #accessLevel-cell="{ row }">
              <UBadge
                color="neutral"
                :variant="accessLevelVariant[row.original.accessLevel]"
                :label="toLabel(row.original.accessLevel)"
              />
            </template>

            <template #grantedAt-cell="{ row }">
              {{ formatDateTime(row.original.grantedAt) }}
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
          :description="`Are you sure you want to revoke ${data.resource.name} access for ${revokeTarget?.employee?.name ?? 'this employee'}? This action cannot be undone.`"
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
