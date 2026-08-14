type SemanticValue = string | null
type OptionalSemanticValues = readonly SemanticValue[] | null | undefined

export type PolicyRuleTranslationFacts = {
  effect: string
  operation: string
  changeTypes?: readonly string[] | null
  fromLevels?: readonly (string | null)[] | null
  targetLevels?: readonly string[] | null
  subjects: {
    roles?: readonly string[] | null
    departments?: readonly string[] | null
    levels?: readonly string[] | null
    statuses?: readonly string[] | null
  }
  resources: {
    slugs?: readonly string[] | null
    types?: readonly string[] | null
    sensitive?: boolean
  }
}

function normalizeValues(values: readonly SemanticValue[]) {
  return values
    .map(value => value === null ? 'null:' : `string:${value}`)
    .sort()
}

function hasExactValues(actual: OptionalSemanticValues, expected: OptionalSemanticValues) {
  if (actual === undefined || expected === undefined) return actual === expected
  if (actual === null || expected === null) return actual === expected
  if (actual.length !== expected.length) return false

  const normalizedActual = normalizeValues(actual)
  const normalizedExpected = normalizeValues(expected)
  return normalizedActual.every((value, index) => value === normalizedExpected[index])
}

function hasSignature(rule: PolicyRuleTranslationFacts, signature: PolicyRuleTranslationFacts) {
  return rule.effect === signature.effect
    && rule.operation === signature.operation
    && hasExactValues(rule.changeTypes, signature.changeTypes)
    && hasExactValues(rule.fromLevels, signature.fromLevels)
    && hasExactValues(rule.targetLevels, signature.targetLevels)
    && hasExactValues(rule.subjects.roles, signature.subjects.roles)
    && hasExactValues(rule.subjects.departments, signature.subjects.departments)
    && hasExactValues(rule.subjects.levels, signature.subjects.levels)
    && hasExactValues(rule.subjects.statuses, signature.subjects.statuses)
    && hasExactValues(rule.resources.slugs, signature.resources.slugs)
    && hasExactValues(rule.resources.types, signature.resources.types)
    && rule.resources.sensitive === signature.resources.sensitive
}

const RULE_SIGNATURES = {
  'inactive-privilege-growth': {
    privilegeGrowth: {
      effect: 'deny',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      subjects: { statuses: ['inactive'] },
      resources: {}
    }
  },
  'universal-access-reduction': {
    downgrade: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['downgrade'],
      subjects: {},
      resources: {}
    },
    revoke: {
      effect: 'allow',
      operation: 'revoke_access',
      changeTypes: ['revoke'],
      subjects: {},
      resources: {}
    }
  },
  'engineering-collaboration': {
    collaboration: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write'],
      subjects: { roles: ['developer'], statuses: ['active'] },
      resources: { slugs: ['github', 'jira', 'staging'] }
    }
  },
  'qa-delivery': {
    delivery: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write'],
      subjects: { roles: ['qa'], statuses: ['active'] },
      resources: { slugs: ['jira', 'staging'] }
    }
  },
  'support-operations': {
    jira: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write'],
      subjects: { roles: ['support'], statuses: ['active'] },
      resources: { slugs: ['jira'] }
    },
    vpnRead: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read'],
      subjects: { roles: ['support'], statuses: ['active'] },
      resources: { slugs: ['vpn'] }
    }
  },
  'design-collaboration': {
    jiraRead: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read'],
      subjects: { roles: ['designer'], statuses: ['active'] },
      resources: { slugs: ['jira'] }
    }
  },
  'product-management': {
    jira: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write', 'admin'],
      subjects: { roles: ['product_manager'], statuses: ['active'] },
      resources: { slugs: ['jira'] }
    },
    githubRead: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read'],
      subjects: { roles: ['product_manager'], statuses: ['active'] },
      resources: { slugs: ['github'] }
    }
  },
  'devops-platform': {
    platform: {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write', 'admin'],
      subjects: {
        roles: ['devops'],
        levels: ['senior', 'lead'],
        statuses: ['active']
      },
      resources: { slugs: ['github', 'vpn', 'staging', 'production'] }
    }
  }
} as const satisfies Record<string, Record<string, PolicyRuleTranslationFacts>>

export function policyRuleTranslationId(policyKey: string, rule: PolicyRuleTranslationFacts): string | null {
  const signatures = RULE_SIGNATURES[policyKey as keyof typeof RULE_SIGNATURES]
  if (!signatures) return null

  for (const [ruleId, signature] of Object.entries(signatures) as [string, PolicyRuleTranslationFacts][]) {
    if (hasSignature(rule, signature)) return ruleId
  }

  return null
}
