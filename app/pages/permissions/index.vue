<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'
import { api } from '#convex/api'

const UButton = resolveComponent('UButton')

const { t, locale } = useI18n()
const dateLocale = computed(() => locale.value === 'es' ? 'es-ES' : 'en-US')
const { data: permissions, status, error } = await useConvexQuery(api.permissions.list, {})

const accessLevelVariant = {
  read: 'outline',
  write: 'subtle',
  admin: 'solid'
} as const

const search = ref('')
const accessLevelFilter = ref('all')
const accessLevelItems = computed(() => [
  { label: t('common.status.all'), value: 'all' },
  { label: t('common.accessLevel.read'), value: 'read' },
  { label: t('common.accessLevel.write'), value: 'write' },
  { label: t('common.accessLevel.admin'), value: 'admin' }
])

function accessLevelLabel(level: keyof typeof accessLevelVariant) {
  return t(`common.accessLevel.${level}`)
}

const filteredPermissions = computed(() => {
  return (permissions.value ?? []).filter((permission) => {
    const term = search.value.toLowerCase()
    const matchesSearch
      = !term
        || permission.employee?.name.toLowerCase().includes(term)
        || permission.resource?.name.toLowerCase().includes(term)
    const matchesAccessLevel = accessLevelFilter.value === 'all' || permission.accessLevel === accessLevelFilter.value

    return matchesSearch && matchesAccessLevel
  })
})

type PermissionRow = NonNullable<typeof permissions.value>[number]

const columns = computed<TableColumn<PermissionRow>[]>(() => [
  {
    accessorKey: 'employee',
    header: t('common.table.employee')
  },
  {
    accessorKey: 'resource',
    header: t('common.table.resource')
  },
  {
    accessorKey: 'accessLevel',
    header: t('common.table.accessLevel'),
    filterFn: 'equals'
  },
  {
    accessorKey: 'grantedAt',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: t('common.table.grantedAt'),
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  }
])
</script>

<template>
  <UDashboardPanel id="permissions">
    <template #header>
      <UDashboardNavbar
        :title="t('permissions.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('permissions.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          :placeholder="t('permissions.filterSearch')"
        />

        <USelect
          v-model="accessLevelFilter"
          :items="accessLevelItems"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
          :placeholder="t('permissions.filterAccess')"
          class="min-w-36"
        />
      </div>

      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        {{ t('permissions.loading') }}
      </p>

      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <template v-else>
        <UTable
          :data="filteredPermissions"
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
                :alt="row.original.employee?.name ?? '?'"
                size="sm"
              />

              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ row.original.employee?.name ?? t('common.unknown.employee') }}
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
              <span class="font-medium text-highlighted">
                {{ row.original.resource?.name ?? t('common.unknown.resource') }}
              </span>
              <UBadge
                v-if="row.original.resource?.sensitive"
                color="warning"
                variant="subtle"
                :label="t('common.resourceSensitivity.sensitive')"
              />
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
        </UTable>

        <div
          v-if="!filteredPermissions.length && permissions?.length"
          class="py-12 text-center text-muted"
        >
          {{ t('permissions.noResults') }}
        </div>

        <div
          v-else-if="!permissions?.length"
          class="py-16 text-center"
        >
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
            <UIcon
              name="i-lucide-shield"
              class="size-5 text-dimmed"
            />
          </div>

          <p class="text-sm font-medium text-highlighted">
            {{ t('permissions.empty') }}
          </p>
          <p class="mt-1 text-sm text-dimmed">
            {{ t('permissions.emptyDescription') }}
          </p>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
