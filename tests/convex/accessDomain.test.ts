import { describe, expect, it } from 'vitest'
import {
  classifyAccessChange,
  isApprovalRequired
} from '../../convex/domain/access'
import { evaluatePolicy } from '../../convex/domain/policyEngine'
import {
  AccessLevel,
  Department,
  EmployeeStatus,
  Level,
  ResourceType,
  Role
} from '../../convex/helpers/validators'

const employee = {
  role: Role.Developer,
  level: Level.Senior,
  department: Department.Engineering,
  status: EmployeeStatus.Active
}

const resource = {
  slug: 'github',
  type: ResourceType.Application,
  sensitive: false
}

describe('access transitions', () => {
  it.each([
    [null, AccessLevel.Read, 'grant'],
    [AccessLevel.Read, AccessLevel.Admin, 'upgrade'],
    [AccessLevel.Admin, AccessLevel.Write, 'downgrade'],
    [AccessLevel.Write, AccessLevel.Write, 'unchanged']
  ] as const)('classifies %s -> %s as %s', (current, target, expected) => {
    expect(classifyAccessChange(current, target)).toBe(expected)
  })

  it('requires approval for sensitive resources only', () => {
    expect(isApprovalRequired({ sensitive: true })).toBe(true)
    expect(isApprovalRequired({ sensitive: false })).toBe(false)
  })
})

describe('default-deny policy evaluation', () => {
  const allowRule = {
    policyId: 'engineering-v1',
    policyKey: 'engineering-collaboration',
    policyVersion: 1,
    effect: 'allow' as const,
    operation: 'set_access_level' as const,
    changeTypes: ['grant', 'upgrade'] as const,
    subjects: {
      roles: [Role.Developer],
      statuses: [EmployeeStatus.Active]
    },
    resources: { slugs: ['github'] },
    targetLevels: [AccessLevel.Read, AccessLevel.Write],
    reason: 'Active developers may collaborate on GitHub.'
  }

  it('allows an explicitly covered transition', () => {
    expect(evaluatePolicy({
      operation: 'set_access_level',
      changeType: 'grant',
      fromLevel: null,
      targetLevel: AccessLevel.Write,
      employee,
      resource,
      rules: [allowRule]
    })).toMatchObject({
      decision: 'allow',
      policies: [{ key: 'engineering-collaboration', version: 1 }]
    })
  })

  it('denies when no active rule applies', () => {
    expect(evaluatePolicy({
      operation: 'set_access_level',
      changeType: 'grant',
      fromLevel: null,
      targetLevel: AccessLevel.Admin,
      employee,
      resource,
      rules: [allowRule]
    })).toEqual({
      decision: 'deny',
      code: 'no_applicable_policy',
      reason: 'No active policy allows this access transition.'
    })
  })

  it('gives an explicit deny precedence over an allow', () => {
    const denyRule = {
      ...allowRule,
      policyId: 'inactive-v1',
      policyKey: 'inactive-privilege-growth',
      effect: 'deny' as const,
      subjects: { statuses: [EmployeeStatus.Inactive] },
      reason: 'Inactive employees cannot gain privileges.'
    }

    const broadAllow = {
      ...allowRule,
      subjects: { roles: [Role.Developer] }
    }

    expect(evaluatePolicy({
      operation: 'set_access_level',
      changeType: 'upgrade',
      fromLevel: AccessLevel.Read,
      targetLevel: AccessLevel.Write,
      employee: { ...employee, status: EmployeeStatus.Inactive },
      resource,
      rules: [broadAllow, denyRule]
    })).toMatchObject({
      decision: 'deny',
      policies: [{ key: 'inactive-privilege-growth', version: 1 }]
    })
  })
})
