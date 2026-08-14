<script setup lang="ts">
const CONCEPTS = [
  {
    icon: 'i-lucide-shield-check',
    title: 'A deterministic Policy Engine decides',
    description: 'Every access change — from the UI or from the AI agent — goes through the same TypeScript rule engine. The agent can propose a change; it can never apply one the policy catalog doesn\'t allow.'
  },
  {
    icon: 'i-lucide-user-check',
    title: 'Sensitive resources need a human',
    description: 'Resources marked sensitive (like Production) can\'t be granted directly, even by the agent. The request becomes an approval instead, and no permission changes until an admin decides.'
  },
  {
    icon: 'i-lucide-history',
    title: 'Everything is audited',
    description: 'Grants, revokes, denials, policy toggles, and agent actions all write to the same audit trail — so you can always see who, or what, did something, and why.'
  }
] as const

const FEATURES = [
  {
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    title: 'Overview',
    description: 'Live counts and a feed of the most recent actions across the whole system.'
  },
  {
    to: '/employees',
    icon: 'i-lucide-users',
    title: 'Employees',
    description: 'Browse the team and open any employee to see, and change, their access to every company resource.'
  },
  {
    to: '/agent',
    icon: 'i-lucide-bot',
    title: 'Agent',
    description: 'Ask in plain language — "What access does María have to GitHub?" or "Give Pedro read access to Jira." Responses stream in real time, with every tool call shown as it happens.'
  },
  {
    to: '/resources',
    icon: 'i-lucide-server',
    title: 'Resources',
    description: 'The applications, environments, and infrastructure access can be granted to, including which ones are marked sensitive.'
  },
  {
    to: '/permissions',
    icon: 'i-lucide-shield-check',
    title: 'Permissions',
    description: 'Every active grant across the organization, in one sortable table.'
  },
  {
    to: '/policies',
    icon: 'i-lucide-gavel',
    title: 'Policies',
    description: 'The actual rule catalog the Policy Engine enforces. Deactivate a rule and watch what the agent and the UI are allowed to do change immediately.'
  },
  {
    to: '/audit-log',
    icon: 'i-lucide-history',
    title: 'Audit Log',
    description: 'The full trail — what was requested, whether it was granted, denied, or sent for approval, and whether an admin or the agent did it.'
  }
] as const

const TRY_IT = [
  {
    to: '/agent',
    icon: 'i-lucide-message-circle-question',
    title: 'Ask the agent a question',
    description: '"What access does María have to GitHub?" — watch it look up the employee and the resource, then answer.'
  },
  {
    to: '/agent',
    icon: 'i-lucide-shield-plus',
    title: 'Request a real change',
    description: '"Give Pedro read access to Jira." A real grant happens, if the policy catalog allows it.'
  },
  {
    to: '/policies',
    icon: 'i-lucide-toggle-left',
    title: 'Toggle a policy off',
    description: 'Deactivate the rule that allowed the request above, then ask again — the outcome changes immediately.'
  },
  {
    to: '/audit-log',
    icon: 'i-lucide-list-checks',
    title: 'Check the trail',
    description: 'Everything above is already there, in order, with who did it and why.'
  }
] as const

const TECH_STACK = [
  { label: 'Nuxt 4 + Vue 3 + Nuxt UI', detail: 'Frontend and dashboard layout' },
  { label: 'Convex', detail: 'Database, queries, mutations, and HTTP Actions — no separate backend server' },
  { label: '@convex-dev/agent + Groq', detail: 'The agent\'s tool-calling loop and language model' },
  { label: 'Vercel AI SDK (ai + @ai-sdk/vue)', detail: 'Real token-by-token streaming from the agent to the browser' },
  { label: '@convex-dev/rag + Google embeddings', detail: 'Advisory policy search the agent can cite — never authoritative' },
  { label: 'TypeScript, strict mode', detail: 'End to end, including the policy engine itself' }
] as const
</script>

<template>
  <UDashboardPanel id="learn">
    <template #header>
      <UDashboardNavbar
        title="Learn"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          What this demo is, how it's built, and how to try it yourself.
        </p>
      </div>
    </template>

    <template #body>
      <div class="mx-auto flex max-w-4xl flex-col gap-10">
        <section>
          <h1 class="text-xl font-semibold text-highlighted">
            Axalot
          </h1>
          <p class="mt-2 text-sm leading-6 text-muted">
            Axalot is an internal IAM (identity and access management) console. An administrator
            reviews or changes what employees can access — through the UI or by talking to an AI
            agent in plain language. The agent can look things up and propose changes, but a
            deterministic backend decides what's actually allowed.
          </p>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-highlighted">
            How access control works here
          </h2>
          <div class="mt-3 grid gap-4 sm:grid-cols-3">
            <UPageCard
              v-for="concept in CONCEPTS"
              :key="concept.title"
              :icon="concept.icon"
              :title="concept.title"
              :description="concept.description"
              variant="subtle"
              :ui="{ wrapper: 'items-stretch' }"
            />
          </div>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-highlighted">
            What you can do
          </h2>
          <UPageGrid class="mt-3 gap-4 sm:grid-cols-2">
            <UPageCard
              v-for="feature in FEATURES"
              :key="feature.title"
              :icon="feature.icon"
              :title="feature.title"
              :description="feature.description"
              :to="feature.to"
              variant="subtle"
              :ui="{ wrapper: 'items-stretch' }"
            />
          </UPageGrid>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-highlighted">
            Try it yourself
          </h2>
          <p class="mt-1 text-sm text-muted">
            A short path that touches most of the system in under a minute.
          </p>
          <div class="mt-3 grid gap-3">
            <ULink
              v-for="(step, index) in TRY_IT"
              :key="step.title"
              :to="step.to"
              class="group flex items-start gap-3 rounded-lg border border-default p-3 transition hover:border-accented hover:bg-elevated/50"
            >
              <div class="grid size-7 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-muted">
                {{ index + 1 }}
              </div>

              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
                  <UIcon
                    :name="step.icon"
                    class="size-4 text-dimmed"
                  />
                  {{ step.title }}
                </p>
                <p class="mt-0.5 text-xs text-dimmed">
                  {{ step.description }}
                </p>
              </div>

              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5"
              />
            </ULink>
          </div>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-highlighted">
            Under the hood
          </h2>
          <div class="mt-3 divide-y divide-default rounded-lg border border-default">
            <div
              v-for="item in TECH_STACK"
              :key="item.label"
              class="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span class="text-sm font-medium text-highlighted">{{ item.label }}</span>
              <span class="text-xs text-dimmed sm:text-right">{{ item.detail }}</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
