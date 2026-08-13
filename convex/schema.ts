import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  accessChangeTypeValidator,
  accessLevelValidator,
  accessOperationValidator,
  actionProposalStatusValidator,
  approvalStatusValidator,
  auditStatusValidator,
  auditSourceValidator,
  departmentValidator,
  employeeStatusValidator,
  levelValidator,
  policyEffectValidator,
  policyStatusValidator,
  resourceTypeValidator,
  roleValidator
} from './helpers/validators'

export default defineSchema({
  employees: defineTable({
    name: v.string(),
    email: v.string(),

    role: roleValidator,

    level: levelValidator,

    department: departmentValidator,

    status: employeeStatusValidator
  })
    .index('by_email', ['email'])
    .index('by_department', ['department']), // 👈 Útil si filtraste empleados por dpto.

  resources: defineTable({
    name: v.string(),
    slug: v.string(),

    type: resourceTypeValidator,

    sensitive: v.boolean()
  }).index('by_slug', ['slug']),

  permissions: defineTable({
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),

    accessLevel: accessLevelValidator,

    grantedAt: v.number()
  })
    .index('by_resource', ['resourceId'])
    .index('by_employee_resource', [
      'employeeId',
      'resourceId'
    ]), // 👈 by_employee_resource also serves employeeId-only lookups (prefix match)

  policies: defineTable({
    key: v.string(),
    version: v.number(),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    status: policyStatusValidator,
    createdAt: v.number()
  })
    .index('by_key_version', ['key', 'version'])
    .index('by_key_status', ['key', 'status'])
    .index('by_status', ['status']),

  policyRules: defineTable({
    policyId: v.id('policies'),
    effect: policyEffectValidator,
    operation: accessOperationValidator,
    changeTypes: v.optional(v.array(accessChangeTypeValidator)),
    fromLevels: v.optional(v.array(v.union(v.null(), accessLevelValidator))),
    targetLevels: v.optional(v.array(accessLevelValidator)),
    subjects: v.object({
      roles: v.optional(v.array(roleValidator)),
      departments: v.optional(v.array(departmentValidator)),
      levels: v.optional(v.array(levelValidator)),
      statuses: v.optional(v.array(employeeStatusValidator))
    }),
    resources: v.object({
      slugs: v.optional(v.array(v.string())),
      types: v.optional(v.array(resourceTypeValidator)),
      sensitive: v.optional(v.boolean())
    }),
    reason: v.string()
  }).index('by_policy', ['policyId']),

  agentConversations: defineTable({
    ownerId: v.string(),
    threadId: v.string(),
    createdAt: v.number()
  }).index('by_owner', ['ownerId']),

  actionProposals: defineTable({
    conversationId: v.id('agentConversations'),
    operation: accessOperationValidator,
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    fromLevel: v.union(v.null(), accessLevelValidator),
    targetLevel: v.union(v.null(), accessLevelValidator),
    changeType: accessChangeTypeValidator,
    policyEvidence: v.array(v.object({
      policyId: v.id('policies'),
      key: v.string(),
      version: v.number(),
      reason: v.string()
    })),
    requestedBy: v.string(),
    requestedSource: auditSourceValidator,
    status: actionProposalStatusValidator,
    result: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    decidedAt: v.optional(v.number())
  })
    .index('by_conversation_status', ['conversationId', 'status'])
    .index('by_expires_at', ['expiresAt']),

  approvals: defineTable({
    operation: accessOperationValidator,
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    fromLevel: v.union(v.null(), accessLevelValidator),
    targetLevel: v.union(v.null(), accessLevelValidator),
    changeType: accessChangeTypeValidator,
    policyEvidence: v.array(v.object({
      policyId: v.id('policies'),
      key: v.string(),
      version: v.number(),
      reason: v.string()
    })),
    requestedBy: v.string(),
    requestedSource: auditSourceValidator,
    status: approvalStatusValidator,
    createdAt: v.number(),
    expiresAt: v.number(),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    decisionReason: v.optional(v.string())
  })
    .index('by_employee_resource_status', ['employeeId', 'resourceId', 'status'])
    .index('by_status', ['status'])
    .index('by_expires_at', ['expiresAt']),

  auditLogs: defineTable({
    action: v.string(),

    employeeId: v.optional(
      v.id('employees')
    ),

    resourceId: v.optional(
      v.id('resources')
    ),

    status: auditStatusValidator,

    source: auditSourceValidator,

    actorId: v.optional(v.string()),

    proposalId: v.optional(v.id('actionProposals')),

    approvalId: v.optional(v.id('approvals')),

    metadata: v.optional(v.any()),

    createdAt: v.number()
  })
    .index('by_created_at', ['createdAt'])
})
