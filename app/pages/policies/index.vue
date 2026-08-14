<script setup lang="ts">
import { api } from '#convex/api'
import { PolicyStatus } from '../../../convex/helpers/validators'

const toast = useToast()
const { t, te } = useI18n()

const { data: policies, status, error } = await useConvexQuery(api.policies.list, {})
const setStatus = useConvexMutation(api.policies.setStatus)

const pendingId = ref<string | null>(null)

type ListedPolicy = NonNullable<typeof policies.value>[number]
type ListedPolicyRule = ListedPolicy['rules'][number]

const EFFECT_COLOR = {
  allow: 'success',
  deny: 'error'
} as const

const SUBJECT_VALUE_KEYS = {
  roles: {
    developer: 'policies.subjectValues.role.developer',
    devops: 'policies.subjectValues.role.devops',
    qa: 'policies.subjectValues.role.qa',
    designer: 'policies.subjectValues.role.designer',
    product_manager: 'policies.subjectValues.role.productManager',
    support: 'policies.subjectValues.role.support'
  },
  levels: {
    senior: 'policies.subjectValues.level.senior',
    lead: 'policies.subjectValues.level.lead'
  }
} as const

function localizedPolicyTitle(policy: ListedPolicy) {
  const key = `policies.catalog.${policy.key}.title`
  return te(key) ? t(key) : policy.title
}

function localizedPolicyDescription(policy: ListedPolicy) {
  const key = `policies.catalog.${policy.key}.description`
  return te(key) ? t(key) : policy.description
}

function localizedRuleReason(policyKey: string, rule: ListedPolicyRule) {
  const ruleId = policyRuleTranslationId(policyKey, rule)
  if (!ruleId) return rule.reason

  const key = `policies.catalog.${policyKey}.rules.${ruleId}`
  return te(key) ? t(key) : rule.reason
}

function formatList(values?: readonly string[] | null) {
  if (!values || values.length === 0) return null
  return values.map(value => toLabel(value)).join(', ')
}

function localizedSubjectList(values: readonly string[] | null | undefined, group: keyof typeof SUBJECT_VALUE_KEYS) {
  if (!values || values.length === 0) return null

  const keys = SUBJECT_VALUE_KEYS[group] as Record<string, string>
  return values.map((value) => {
    const key = keys[value]
    return key && te(key) ? t(key) : toLabel(value)
  }).join(', ')
}

function accessLevelList(values?: readonly string[] | null) {
  if (!values || values.length === 0) return null
  return values.map(value => ['read', 'write', 'admin'].includes(value) ? t(`common.accessLevel.${value}`) : toLabel(value)).join(', ')
}

function employeeStatusList(values?: readonly string[] | null) {
  if (!values || values.length === 0) return null
  return values.map(value => ['active', 'inactive'].includes(value) ? t(`common.status.${value}`) : toLabel(value)).join(', ')
}

function policyStatusLabel(status: string) {
  return ['active', 'draft', 'superseded'].includes(status) ? t(`policies.status.${status}`) : toLabel(status)
}

function operationLabel(operation: string) {
  if (operation === 'set_access_level') return t('policies.operation.setAccessLevel')
  if (operation === 'revoke_access') return t('policies.operation.revoke')
  return toLabel(operation)
}

function subjectSummary(rule: { subjects: { roles?: readonly string[], departments?: readonly string[], levels?: readonly string[], statuses?: readonly string[] } }) {
  const roles = localizedSubjectList(rule.subjects.roles, 'roles')
  const levels = localizedSubjectList(rule.subjects.levels, 'levels')
  const parts = [
    roles && t('policies.subject.role', { values: roles }),
    formatList(rule.subjects.departments) && t('policies.subject.department', { values: formatList(rule.subjects.departments) }),
    levels && t('policies.subject.level', { values: levels }),
    employeeStatusList(rule.subjects.statuses) && t('policies.subject.status', { values: employeeStatusList(rule.subjects.statuses) })
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : t('policies.anyEmployee')
}

function resourceSummary(rule: { resources: { slugs?: readonly string[], types?: readonly string[], sensitive?: boolean } }) {
  const parts = [
    formatList(rule.resources.slugs),
    rule.resources.types?.map(type => ['application', 'environment', 'infrastructure'].includes(type) ? t(`common.resourceType.${type}`) : toLabel(type)).join(', '),
    rule.resources.sensitive === undefined ? null : t(rule.resources.sensitive ? 'policies.resource.sensitiveOnly' : 'policies.resource.nonSensitiveOnly')
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : t('policies.anyResource')
}

async function toggleStatus(policy: NonNullable<typeof policies.value>[number]) {
  const nextStatus = policy.status === PolicyStatus.Active ? PolicyStatus.Superseded : PolicyStatus.Active

  pendingId.value = policy._id

  try {
    await setStatus({ policyId: policy._id, status: nextStatus })

    toast.add({
      title: t(nextStatus === PolicyStatus.Active ? 'policies.activated' : 'policies.deactivated'),
      description: t('policies.updatedDescription', {
        title: localizedPolicyTitle(policy),
        state: t(nextStatus === PolicyStatus.Active ? 'policies.enforced' : 'policies.inactive')
      }),
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: t('policies.couldNotUpdate'),
      description: (err as Error).message,
      color: 'error'
    })
  } finally {
    pendingId.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="policies">
    <template #header>
      <UDashboardNavbar
        :title="t('policies.title')"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          {{ t('policies.description') }}
        </p>
      </div>
    </template>

    <template #body>
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        {{ t('policies.loading') }}
      </p>

      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error.message"
      />

      <div
        v-else
        class="space-y-4"
      >
        <UCard
          v-for="policy in policies"
          :key="policy._id"
          variant="subtle"
        >
          <template #header>
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="font-semibold text-highlighted">
                    {{ localizedPolicyTitle(policy) }}
                  </h2>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    :label="`v${policy.version}`"
                  />
                  <UBadge
                    :color="policy.status === PolicyStatus.Active ? 'success' : 'neutral'"
                    variant="subtle"
                    :label="policyStatusLabel(policy.status)"
                  />
                </div>
                <p class="mt-1 text-sm text-muted">
                  {{ localizedPolicyDescription(policy) }}
                </p>
              </div>

              <USwitch
                :model-value="policy.status === PolicyStatus.Active"
                :loading="pendingId === policy._id"
                :disabled="pendingId === policy._id"
                :aria-label="t('policies.toggleAria', { title: localizedPolicyTitle(policy) })"
                @update:model-value="toggleStatus(policy)"
              />
            </div>
          </template>

          <div class="space-y-2">
            <div
              v-for="rule in policy.rules"
              :key="rule._id"
              class="flex items-start gap-3 rounded-md border border-default px-3 py-2.5"
            >
              <UBadge
                :color="EFFECT_COLOR[rule.effect]"
                variant="subtle"
                :label="t(`policies.effect.${rule.effect}`)"
                class="mt-0.5"
              />

              <div class="min-w-0 flex-1 text-sm">
                <p class="font-medium text-highlighted">
                  {{ operationLabel(rule.operation) }}
                  <span
                    v-if="rule.targetLevels?.length"
                    class="font-normal text-muted"
                  > → {{ accessLevelList(rule.targetLevels) }}</span>
                </p>
                <p class="mt-0.5 text-xs text-dimmed">
                  {{ subjectSummary(rule) }} · {{ resourceSummary(rule) }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  {{ localizedRuleReason(policy.key, rule) }}
                </p>
              </div>
            </div>

            <p
              v-if="!policy.rules.length"
              class="text-sm text-dimmed"
            >
              {{ t('policies.noRules') }}
            </p>
          </div>
        </UCard>

        <div
          v-if="!policies?.length"
          class="py-16 text-center"
        >
          <div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-elevated">
            <UIcon
              name="i-lucide-gavel"
              class="size-5 text-dimmed"
            />
          </div>

          <p class="text-sm font-medium text-highlighted">
            {{ t('policies.empty') }}
          </p>
          <p class="mt-1 text-sm text-dimmed">
            {{ t('policies.emptyDescription') }}
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
