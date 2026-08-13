<script setup lang="ts">
import { api } from '#convex/api'

const { data: employees, error } = await useConvexQuery(api.employees.list, {})

const search = ref('')
const statusFilter = ref('all')

const filteredEmployees = computed(() => {
  return (employees.value ?? []).filter((employee) => {
    const matchesSearch = !search.value || employee.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'all' || employee.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})
</script>

<template>
  <UDashboardPanel id="employees">
    <template #header>
      <UDashboardNavbar
        title="Employees"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          Browse employees and manage their resource access.
        </p>
      </div>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <UInput
            v-model="search"
            class="max-w-sm"
            icon="i-lucide-search"
            placeholder="Filter by name..."
          />

          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter status"
            class="min-w-28"
          />
        </div>

        <UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UPageCard
            v-for="employee in filteredEmployees"
            :key="employee._id"
            :title="employee.name"
            :description="employee.email"
            :to="`/employees/${employee._id}`"
            variant="subtle"
            :ui="{ container: 'p-4 sm:p-4 gap-y-3', leading: 'mb-0' }"
          >
            <template #leading>
              <UAvatar
                :alt="employee.name"
                size="lg"
              />
            </template>

            <template #footer>
              <div class="flex flex-wrap gap-1.5">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  :label="toLabel(employee.role)"
                />
                <UBadge
                  color="neutral"
                  variant="subtle"
                  :label="toLabel(employee.level)"
                />
                <UBadge
                  color="neutral"
                  variant="subtle"
                  :label="toLabel(employee.department)"
                />
                <UBadge
                  :color="employee.status === 'active' ? 'success' : 'neutral'"
                  variant="subtle"
                  :label="toLabel(employee.status)"
                />
              </div>
            </template>
          </UPageCard>
        </UPageGrid>

        <div
          v-if="!filteredEmployees.length"
          class="py-12 text-center text-muted"
        >
          No employees found.
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
