<template>
  <UDashboardPanel id="agent">
    <template #header>
      <UDashboardNavbar
        title="Agent"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-3 sm:px-6">
        <p class="text-sm text-muted">
          Manage employee access using natural language.
        </p>
      </div>
    </template>

    <template #body>
      <p class="text-muted">
        No content yet.
      </p>
    </template>
  </UDashboardPanel>
</template>
