import type {
  AccessChangeType,
  AccessLevel,
  AccessOperation,
  Department,
  EmployeeStatus,
  Level,
  ResourceType,
  Role
} from '../helpers/validators'

type EmployeeFacts = {
  role: Role
  level: Level
  department: Department
  status: EmployeeStatus
}

type ResourceFacts = {
  slug: string
  type: ResourceType
  sensitive: boolean
}

export type PolicyRuleFacts = {
  policyId: string
  policyKey: string
  policyVersion: number
  effect: 'allow' | 'deny'
  operation: `${AccessOperation}`
  changeTypes?: readonly `${AccessChangeType}`[]
  fromLevels?: readonly (AccessLevel | null)[]
  targetLevels?: readonly AccessLevel[]
  subjects: {
    roles?: readonly Role[]
    departments?: readonly Department[]
    levels?: readonly Level[]
    statuses?: readonly EmployeeStatus[]
  }
  resources: {
    slugs?: readonly string[]
    types?: readonly ResourceType[]
    sensitive?: boolean
  }
  reason: string
}

export type PolicyEvidence = {
  policyId: string
  key: string
  version: number
  reason: string
}

export type PolicyDecision
  = | {
    decision: 'allow'
    policies: PolicyEvidence[]
    reason: string
  }
  | {
    decision: 'deny'
    policies: PolicyEvidence[]
    reason: string
  }
  | {
    decision: 'deny'
    code: 'no_applicable_policy'
    reason: string
  }

type PolicyRequest = {
  operation: `${AccessOperation}`
  changeType: `${AccessChangeType}`
  fromLevel: AccessLevel | null
  targetLevel: AccessLevel | null
  employee: EmployeeFacts
  resource: ResourceFacts
  rules: readonly PolicyRuleFacts[]
}

function matchesList<T>(selector: readonly T[] | undefined, value: T) {
  return selector === undefined || selector.includes(value)
}

function matchesRule(rule: PolicyRuleFacts, request: PolicyRequest) {
  return rule.operation === request.operation
    && matchesList(rule.changeTypes, request.changeType)
    && matchesList(rule.fromLevels, request.fromLevel)
    && (request.targetLevel === null
      ? rule.targetLevels === undefined
      : matchesList(rule.targetLevels, request.targetLevel))
    && matchesList(rule.subjects.roles, request.employee.role)
    && matchesList(rule.subjects.departments, request.employee.department)
    && matchesList(rule.subjects.levels, request.employee.level)
    && matchesList(rule.subjects.statuses, request.employee.status)
    && matchesList(rule.resources.slugs, request.resource.slug)
    && matchesList(rule.resources.types, request.resource.type)
    && (rule.resources.sensitive === undefined
      || rule.resources.sensitive === request.resource.sensitive)
}

function evidence(rule: PolicyRuleFacts): PolicyEvidence {
  return {
    policyId: rule.policyId,
    key: rule.policyKey,
    version: rule.policyVersion,
    reason: rule.reason
  }
}

export function evaluatePolicy(request: PolicyRequest): PolicyDecision {
  const applicable = request.rules.filter(rule => matchesRule(rule, request))
  const denies = applicable.filter(rule => rule.effect === 'deny')

  if (denies.length > 0) {
    return {
      decision: 'deny',
      policies: denies.map(evidence),
      reason: denies.map(rule => rule.reason).join(' ')
    }
  }

  const allows = applicable.filter(rule => rule.effect === 'allow')

  if (allows.length > 0) {
    return {
      decision: 'allow',
      policies: allows.map(evidence),
      reason: allows.map(rule => rule.reason).join(' ')
    }
  }

  return {
    decision: 'deny',
    code: 'no_applicable_policy',
    reason: 'No active policy allows this access transition.'
  }
}
