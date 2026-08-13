<script setup lang="ts">
import { api } from '#convex/api'

const { data: resources, status, error } = await useConvexQuery(api.resources.list, {})

const search = ref('')
const typeFilter = ref('all')

const filteredResources = computed(() => {
  return (resources.value ?? []).filter((resource) => {
    const matchesSearch = !search.value || resource.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesType = typeFilter.value === 'all' || resource.type === typeFilter.value

    return matchesSearch && matchesType
  })
})

function getResourceLetter(name: string) {
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <UDashboardPanel id="resources">
    <template #header>
      <UDashboardNavbar
        title="Resources"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          Manage company applications, environments and infrastructure.
        </p>
      </div>
    </template>

    <template #body>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="search"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter by name..."
        />

        <USelect
          v-model="typeFilter"
          :items="[
            { label: 'All', value: 'all' },
            { label: 'Application', value: 'application' },
            { label: 'Environment', value: 'environment' },
            { label: 'Infrastructure', value: 'infrastructure' }
          ]"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
          placeholder="Filter type"
          class="min-w-36"
        />
      </div>

      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        Loading resources...
      </p>

      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <div
        v-else
        class="grid gap-4 md:grid-cols-2"
      >
        <NuxtLink
          v-for="resource in filteredResources"
          :key="resource._id"
          :to="`/resources/${resource._id}`"
          class="group block"
        >
          <UCard
            variant="subtle"
            class="transition group-hover:-translate-y-px group-hover:border-accented group-hover:shadow-sm"
            :ui="{ body: 'p-5' }"
          >
            <div class="flex items-start gap-4">
              <div class="grid size-11 shrink-0 place-items-center rounded-xl bg-elevated font-semibold text-toned">
                {{ getResourceLetter(resource.name) }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h2 class="font-semibold text-highlighted">
                      {{ resource.name }}
                    </h2>

                    <p class="mt-1 text-sm text-muted">
                      {{ toLabel(resource.type) }}
                    </p>
                  </div>

                  <UBadge
                    v-if="resource.sensitive"
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

                <div class="mt-5 flex items-center justify-between border-t border-default pt-4">
                  <div>
                    <p class="text-xs text-dimmed">
                      Active permissions
                    </p>
                    <p class="mt-1 text-sm font-medium text-toned">
                      {{ resource.permissionCount }} {{ resource.permissionCount === 1 ? 'employee' : 'employees' }}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </UCard>
        </NuxtLink>

        <div
          v-if="!filteredResources.length && resources?.length"
          class="col-span-full py-12 text-center text-muted"
        >
          No resources found.
        </div>

        <div
          v-else-if="!resources?.length"
          class="col-span-full rounded-lg border border-dashed border-default px-6 py-16 text-center"
        >
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
            <UIcon
              name="i-lucide-server"
              class="size-5 text-dimmed"
            />
          </div>

          <p class="text-sm font-medium text-highlighted">
            No resources yet
          </p>
          <p class="mt-1 text-sm text-dimmed">
            Company resources will appear here once they are added.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
