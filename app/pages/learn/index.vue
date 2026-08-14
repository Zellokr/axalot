<script setup lang="ts">
const { t } = useI18n()

const CONCEPTS = computed(() => [
  {
    icon: 'i-lucide-shield-check',
    title: t('learn.concepts.policy.title'),
    description: t('learn.concepts.policy.description')
  },
  {
    icon: 'i-lucide-user-check',
    title: t('learn.concepts.sensitive.title'),
    description: t('learn.concepts.sensitive.description')
  },
  {
    icon: 'i-lucide-history',
    title: t('learn.concepts.audit.title'),
    description: t('learn.concepts.audit.description')
  }
])

const FEATURES = computed(() => [
  {
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    title: t('navigation.overview'),
    description: t('learn.features.overview')
  },
  {
    to: '/employees',
    icon: 'i-lucide-users',
    title: t('navigation.employees'),
    description: t('learn.features.employees')
  },
  {
    to: '/agent',
    icon: 'i-lucide-bot',
    title: t('navigation.agent'),
    description: t('learn.features.agent')
  },
  {
    to: '/resources',
    icon: 'i-lucide-server',
    title: t('navigation.resources'),
    description: t('learn.features.resources')
  },
  {
    to: '/permissions',
    icon: 'i-lucide-shield-check',
    title: t('navigation.permissions'),
    description: t('learn.features.permissions')
  },
  {
    to: '/approvals',
    icon: 'i-lucide-clipboard-check',
    title: t('navigation.approvals'),
    description: t('learn.features.approvals')
  },
  {
    to: '/policies',
    icon: 'i-lucide-gavel',
    title: t('navigation.policies'),
    description: t('learn.features.policies')
  },
  {
    to: '/audit-log',
    icon: 'i-lucide-history',
    title: t('navigation.auditLog'),
    description: t('learn.features.audit')
  }
])

const TRY_IT = computed(() => [
  {
    to: '/agent',
    icon: 'i-lucide-message-circle-question',
    title: t('learn.tryIt.ask.title'),
    description: t('learn.tryIt.ask.description')
  },
  {
    to: '/agent',
    icon: 'i-lucide-shield-plus',
    title: t('learn.tryIt.request.title'),
    description: t('learn.tryIt.request.description')
  },
  {
    to: '/approvals',
    icon: 'i-lucide-clipboard-check',
    title: t('learn.tryIt.decide.title'),
    description: t('learn.tryIt.decide.description')
  },
  {
    to: '/policies',
    icon: 'i-lucide-toggle-left',
    title: t('learn.tryIt.policy.title'),
    description: t('learn.tryIt.policy.description')
  },
  {
    to: '/audit-log',
    icon: 'i-lucide-list-checks',
    title: t('learn.tryIt.audit.title'),
    description: t('learn.tryIt.audit.description')
  }
])

const TECH_STACK = computed(() => [
  { label: 'Nuxt 4 + Vue 3 + Nuxt UI', detail: t('learn.tech.frontend') },
  { label: 'Convex', detail: t('learn.tech.convex') },
  { label: '@convex-dev/agent + Groq', detail: t('learn.tech.agent') },
  { label: 'Vercel AI SDK (ai + @ai-sdk/vue)', detail: t('learn.tech.streaming') },
  { label: '@convex-dev/rag + Google embeddings', detail: t('learn.tech.rag') },
  { label: t('learn.tech.typescriptLabel'), detail: t('learn.tech.typescript') }
])
</script>

<template>
  <UDashboardPanel id="learn">
    <template #header>
      <UDashboardNavbar
        :title="t('learn.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('learn.description') }}
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
            {{ t('learn.intro') }}
          </p>
        </section>

        <section>
          <h2 class="text-sm font-semibold text-highlighted">
            {{ t('learn.sections.accessControl') }}
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
            {{ t('learn.sections.features') }}
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
            {{ t('learn.sections.tryIt') }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ t('learn.sections.tryItDescription') }}
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
            {{ t('learn.sections.tech') }}
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
