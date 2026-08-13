import type { GenericId } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  AccessChangeType,
  AccessLevel,
  AccessOperation,
  EmployeeStatus,
  Level,
  PolicyEffect,
  PolicyStatus,
  Role
} from '../helpers/validators'
import {
  evaluatePolicy,
  type PolicyDecision,
  type PolicyEvidence,
  type PolicyRuleFacts
} from '../domain/policyEngine'

type PolicySeedRule = Omit<Doc<'policyRules'>, '_id' | '_creationTime' | 'policyId'>

type PolicySeed = {
  key: string
  version: number
  title: string
  description: string
  content: string
  rules: PolicySeedRule[]
}

const active = [EmployeeStatus.Active]

export const POLICY_SEEDS: PolicySeed[] = [
  {
    key: 'inactive-privilege-growth',
    version: 1,
    title: 'Inactive employee privilege growth',
    description: 'Inactive employees cannot receive new or increased access.',
    content: 'Deny grants and upgrades for inactive employees. Reductions remain governed by the access reduction policy.',
    rules: [{
      effect: PolicyEffect.Deny,
      operation: AccessOperation.SetAccessLevel,
      changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
      subjects: { statuses: [EmployeeStatus.Inactive] },
      resources: {},
      reason: 'Inactive employees cannot gain privileges.'
    }]
  },
  {
    key: 'universal-access-reduction',
    version: 1,
    title: 'Universal access reduction',
    description: 'Individual access reductions are allowed for active and inactive employees.',
    content: 'Allow individual downgrades and revocations. Sensitive resources still require human approval.',
    rules: [
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.SetAccessLevel,
        changeTypes: [AccessChangeType.Downgrade],
        subjects: {},
        resources: {},
        reason: 'Individual access downgrades are permitted.'
      },
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.RevokeAccess,
        changeTypes: [AccessChangeType.Revoke],
        subjects: {},
        resources: {},
        reason: 'Individual access revocations are permitted.'
      }
    ]
  },
  {
    key: 'engineering-collaboration',
    version: 1,
    title: 'Engineering collaboration access',
    description: 'Active developers may collaborate through GitHub, Jira, and Staging.',
    content: 'Allow active developers read or write access to GitHub, Jira, and Staging.',
    rules: [{
      effect: PolicyEffect.Allow,
      operation: AccessOperation.SetAccessLevel,
      changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
      targetLevels: [AccessLevel.Read, AccessLevel.Write],
      subjects: { roles: [Role.Developer], statuses: active },
      resources: { slugs: ['github', 'jira', 'staging'] },
      reason: 'Active developers may use engineering collaboration resources.'
    }]
  },
  {
    key: 'qa-delivery',
    version: 1,
    title: 'QA delivery access',
    description: 'Active QA employees may use Jira and Staging.',
    content: 'Allow active QA employees read or write access to Jira and Staging.',
    rules: [{
      effect: PolicyEffect.Allow,
      operation: AccessOperation.SetAccessLevel,
      changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
      targetLevels: [AccessLevel.Read, AccessLevel.Write],
      subjects: { roles: [Role.QA], statuses: active },
      resources: { slugs: ['jira', 'staging'] },
      reason: 'Active QA employees may use delivery resources.'
    }]
  },
  {
    key: 'support-operations',
    version: 1,
    title: 'Support operations access',
    description: 'Active support employees may use Jira and VPN within defined levels.',
    content: 'Allow active support employees read or write access to Jira and read access to VPN.',
    rules: [
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.SetAccessLevel,
        changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
        targetLevels: [AccessLevel.Read, AccessLevel.Write],
        subjects: { roles: [Role.Support], statuses: active },
        resources: { slugs: ['jira'] },
        reason: 'Active support employees may work in Jira.'
      },
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.SetAccessLevel,
        changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
        targetLevels: [AccessLevel.Read],
        subjects: { roles: [Role.Support], statuses: active },
        resources: { slugs: ['vpn'] },
        reason: 'Active support employees may receive read access to VPN.'
      }
    ]
  },
  {
    key: 'design-collaboration',
    version: 1,
    title: 'Design collaboration access',
    description: 'Active designers may read Jira.',
    content: 'Allow active designers read access to Jira.',
    rules: [{
      effect: PolicyEffect.Allow,
      operation: AccessOperation.SetAccessLevel,
      changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
      targetLevels: [AccessLevel.Read],
      subjects: { roles: [Role.Designer], statuses: active },
      resources: { slugs: ['jira'] },
      reason: 'Active designers may read Jira.'
    }]
  },
  {
    key: 'product-management',
    version: 1,
    title: 'Product management access',
    description: 'Active product managers may manage Jira and read GitHub.',
    content: 'Allow active product managers read, write, or admin access to Jira and read access to GitHub.',
    rules: [
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.SetAccessLevel,
        changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
        targetLevels: [AccessLevel.Read, AccessLevel.Write, AccessLevel.Admin],
        subjects: { roles: [Role.ProductManager], statuses: active },
        resources: { slugs: ['jira'] },
        reason: 'Active product managers may manage Jira.'
      },
      {
        effect: PolicyEffect.Allow,
        operation: AccessOperation.SetAccessLevel,
        changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
        targetLevels: [AccessLevel.Read],
        subjects: { roles: [Role.ProductManager], statuses: active },
        resources: { slugs: ['github'] },
        reason: 'Active product managers may read GitHub.'
      }
    ]
  },
  {
    key: 'devops-platform',
    version: 1,
    title: 'DevOps platform access',
    description: 'Active senior and lead DevOps employees may administer platform resources.',
    content: 'Allow active senior or lead DevOps employees read, write, or admin access to GitHub, VPN, Staging, and Production. Production remains approval-gated because it is sensitive.',
    rules: [{
      effect: PolicyEffect.Allow,
      operation: AccessOperation.SetAccessLevel,
      changeTypes: [AccessChangeType.Grant, AccessChangeType.Upgrade],
      targetLevels: [AccessLevel.Read, AccessLevel.Write, AccessLevel.Admin],
      subjects: {
        roles: [Role.Devops],
        levels: [Level.Senior, Level.Lead],
        statuses: active
      },
      resources: { slugs: ['github', 'vpn', 'staging', 'production'] },
      reason: 'Active senior and lead DevOps employees may use platform resources.'
    }]
  }
]

function assertNoEmptySelectors(rule: PolicySeedRule) {
  const selectors = [
    rule.changeTypes,
    rule.fromLevels,
    rule.targetLevels,
    rule.subjects.roles,
    rule.subjects.departments,
    rule.subjects.levels,
    rule.subjects.statuses,
    rule.resources.slugs,
    rule.resources.types
  ]

  if (selectors.some(selector => selector?.length === 0)) {
    throw new Error('Policy selector arrays must not be empty.')
  }
}

export async function seedPolicyCatalog(ctx: MutationCtx) {
  let inserted = 0

  for (const policy of POLICY_SEEDS) {
    const existing = await ctx.db
      .query('policies')
      .withIndex('by_key_version', q => q.eq('key', policy.key).eq('version', policy.version))
      .unique()

    if (existing) {
      continue
    }

    const activeVersions = await ctx.db
      .query('policies')
      .withIndex('by_key_status', q => q.eq('key', policy.key).eq('status', PolicyStatus.Active))
      .collect()

    for (const activeVersion of activeVersions) {
      await ctx.db.patch(activeVersion._id, { status: PolicyStatus.Superseded })
    }

    const policyId = await ctx.db.insert('policies', {
      key: policy.key,
      version: policy.version,
      title: policy.title,
      description: policy.description,
      content: policy.content,
      status: PolicyStatus.Active,
      createdAt: Date.now()
    })

    for (const rule of policy.rules) {
      assertNoEmptySelectors(rule)
      await ctx.db.insert('policyRules', { ...rule, policyId })
    }

    inserted += 1
  }

  return inserted
}

export async function getActivePolicyDocuments(ctx: QueryCtx) {
  return await ctx.db
    .query('policies')
    .withIndex('by_status', q => q.eq('status', PolicyStatus.Active))
    .collect()
}

export async function evaluateCurrentPolicies(ctx: QueryCtx | MutationCtx, request: {
  operation: AccessOperation
  changeType: AccessChangeType
  fromLevel: AccessLevel | null
  targetLevel: AccessLevel | null
  employee: Doc<'employees'>
  resource: Doc<'resources'>
}): Promise<PolicyDecision> {
  const policies = await ctx.db
    .query('policies')
    .withIndex('by_status', q => q.eq('status', PolicyStatus.Active))
    .collect()
  const rules = (await Promise.all(policies.map(async (policy) => {
    const policyRules = await ctx.db
      .query('policyRules')
      .withIndex('by_policy', q => q.eq('policyId', policy._id))
      .collect()

    return policyRules.map(rule => ({
      ...rule,
      policyId: policy._id,
      policyKey: policy.key,
      policyVersion: policy.version
    }))
  }))).flat() as PolicyRuleFacts[]

  return evaluatePolicy({ ...request, rules })
}

export function policyEvidenceIds(decision: PolicyDecision) {
  if (!('policies' in decision)) {
    return []
  }

  return decision.policies.map(policy => ({
    ...policy,
    policyId: policy.policyId as GenericId<'policies'>
  }))
}

export function samePolicyEvidence(
  left: readonly PolicyEvidence[],
  right: readonly PolicyEvidence[]
) {
  const fingerprint = (items: readonly PolicyEvidence[]) => items
    .map(item => `${item.policyId}:${item.version}`)
    .sort()
    .join('|')

  return fingerprint(left) === fingerprint(right)
}

export function asPolicyId(value: string) {
  return value as Id<'policies'>
}
