<script setup lang="ts">
import { api } from '#convex/api'
import { AccessLevel } from '../../../convex/helpers/validators'

const route = useRoute()
const toast = useToast()
const { t, locale } = useI18n()
const dateLocale = computed(() => locale.value === 'es' ? 'es-ES' : 'en-US')

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

const setAccessLevel = useConvexMutation(api.permissions.setAccessLevel)
const revokeAccess = useConvexMutation(api.permissions.revokeAccess)

const revokeTarget = ref<PermissionRow | null>(null)

function accessLevelLabel(level: AccessLevelKey) {
  return t(`common.accessLevel.${level}`)
}

function employeeName(permission: PermissionRow, sentence = false) {
  return permission.employee?.name
    ?? t(sentence ? 'resources.detail.fallbackEmployeeSentence' : 'resources.detail.fallbackEmployee')
}

async function changeAccessLevel(permission: PermissionRow, accessLevel: AccessLevelKey) {
  if (!data.value) return

  try {
    const result = await setAccessLevel({
      employeeId: permission.employeeId,
      resourceId: data.value.resource._id,
      targetLevel: ACCESS_LEVEL_ENUM[accessLevel]
    })

    if (result.status === 'policy_denied') {
      toast.add({
        title: t('resources.detail.denied'),
        description: result.policy.reason,
        color: 'error'
      })
      return
    }

    if (result.status === 'approval_required') {
      toast.add({
        title: t('resources.detail.approvalRequested'),
        description: t('resources.detail.approvalRequestedDescription', { name: employeeName(permission) }),
        color: 'warning'
      })
      return
    }

    if (result.status === 'unchanged') {
      toast.add({
        title: t('resources.detail.noChange'),
        description: t('resources.detail.noChangeDescription', {
          name: employeeName(permission, true),
          level: accessLevelLabel(accessLevel),
          resource: data.value.resource.name
        }),
        color: 'neutral'
      })
      return
    }

    toast.add({
      title: t('resources.detail.accessLevelUpdated'),
      description: t('resources.detail.updatedDescription', {
        name: employeeName(permission, true),
        level: accessLevelLabel(accessLevel),
        resource: data.value.resource.name
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('resources.detail.couldNotUpdate'),
      description: (err as Error).message,
      color: 'error'
    })
  }
}

async function confirmRevoke() {
  if (!data.value || !revokeTarget.value) return

  const permission = revokeTarget.value

  try {
    const result = await revokeAccess({
      employeeId: permission.employeeId,
      resourceId: data.value.resource._id
    })

    if (result.status === 'policy_denied') {
      toast.add({
        title: t('resources.detail.revocationDenied'),
        description: result.policy.reason,
        color: 'error'
      })
      return
    }

    if (result.status === 'approval_required') {
      toast.add({
        title: t('resources.detail.approvalRequested'),
        description: t('resources.detail.revokeApprovalDescription', { name: employeeName(permission) }),
        color: 'warning'
      })
      return
    }

    toast.add({
      title: t('resources.detail.revoked'),
      description: t('resources.detail.revokedDescription', {
        name: employeeName(permission, true),
        resource: data.value.resource.name
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('resources.detail.couldNotRevoke'),
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
      label: t('resources.detail.setTo', { level: accessLevelLabel(level) }),
      icon: 'i-lucide-shield',
      onSelect: () => changeAccessLevel(permission, level)
    })),
    [{
      label: t('resources.detail.revokeAccess'),
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
      <UDashboardNavbar :title="data?.resource.name ?? t('resources.detail.fallbackName')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            :label="t('common.actions.back')"
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
        {{ t('resources.detail.notFound') }}
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
                    {{ data.resource.slug }} · {{ t(`common.resourceType.${data.resource.type}`) }}
                  </p>
                </div>

                <UBadge
                  v-if="data.resource.sensitive"
                  color="warning"
                  variant="subtle"
                  class="gap-1.5"
                >
                  <span class="size-1.5 rounded-full bg-warning" />
                  {{ t('common.resourceSensitivity.sensitive') }}
                </UBadge>

                <UBadge
                  v-else
                  color="neutral"
                  variant="subtle"
                  :label="t('common.resourceSensitivity.standard')"
                />
              </div>
            </div>
          </div>
        </UCard>

        <div class="mt-6">
          <h2 class="mb-3 text-sm font-medium text-highlighted">
            {{ t('permissions.title') }}
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
                {{ t('resources.detail.noPermissions') }}
              </p>
              <p class="mt-1 text-sm text-dimmed">
                {{ t('resources.detail.noPermissionsDescription') }}
              </p>
            </div>
          </UCard>

          <UTable
            v-else
            :data="data.permissions"
            :columns="[
              { accessorKey: 'employee', header: t('common.table.employee') },
              { accessorKey: 'accessLevel', header: t('common.table.accessLevel') },
              { accessorKey: 'grantedAt', header: t('common.table.grantedAt') },
              { id: 'actions' }
            ]"
          >
            <template #employee-cell="{ row }">
              <div>
                <p class="font-medium text-highlighted">
                  {{ row.original.employee?.name ?? t('common.unknown.employee') }}
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
                :label="accessLevelLabel(row.original.accessLevel)"
              />
            </template>

            <template #grantedAt-cell="{ row }">
              {{ formatDateTime(row.original.grantedAt, dateLocale) }}
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
          :title="t('resources.detail.revokeAccess')"
          :description="t('resources.detail.revokeDescription', { resource: data.resource.name, name: revokeTarget ? employeeName(revokeTarget) : t('resources.detail.fallbackEmployee') })"
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
