import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'

// ===== Enums =====
export enum Role {
  Developer = 'developer',
  Devops = 'devops',
  QA = 'qa',
  Designer = 'designer',
  ProductManager = 'product_manager',
  Support = 'support'
}
export const roleValidator = literals(...Object.values(Role))

export enum Level {
  Junior = 'junior',
  Mid = 'mid',
  Senior = 'senior',
  Lead = 'lead'
}
export const levelValidator = literals(...Object.values(Level))

export enum Department {
  Engineering = 'engineering',
  Product = 'product',
  Design = 'design',
  Operations = 'operations',
  Support = 'support'
}
export const departmentValidator = literals(...Object.values(Department))

export enum EmployeeStatus {
  Active = 'active',
  Inactive = 'inactive'
}
export const employeeStatusValidator = literals(...Object.values(EmployeeStatus))

export enum ResourceType {
  Application = 'application',
  Environment = 'environment',
  Infrastructure = 'infrastructure'
}
export const resourceTypeValidator = literals(...Object.values(ResourceType))

export enum AccessLevel {
  Read = 'read',
  Write = 'write',
  Admin = 'admin'
}
export const accessLevelValidator = literals(...Object.values(AccessLevel))

export enum AccessChangeType {
  Grant = 'grant',
  Upgrade = 'upgrade',
  Downgrade = 'downgrade',
  Unchanged = 'unchanged',
  Revoke = 'revoke'
}
export const accessChangeTypeValidator = literals(...Object.values(AccessChangeType))

export enum AccessOperation {
  SetAccessLevel = 'set_access_level',
  RevokeAccess = 'revoke_access'
}
export const accessOperationValidator = literals(...Object.values(AccessOperation))

export enum PolicyEffect {
  Allow = 'allow',
  Deny = 'deny'
}
export const policyEffectValidator = literals(...Object.values(PolicyEffect))

export enum PolicyStatus {
  Active = 'active',
  Superseded = 'superseded'
}
export const policyStatusValidator = literals(...Object.values(PolicyStatus))

export enum AuditStatus {
  Success = 'success',
  Rejected = 'rejected',
  Pending = 'pending'
}
export const auditStatusValidator = literals(...Object.values(AuditStatus))

export enum AuditSource {
  Admin = 'admin',
  Agent = 'agent'
}
export const auditSourceValidator = literals(...Object.values(AuditSource))

export enum ActionProposalStatus {
  PendingConfirmation = 'pending_confirmation',
  Executing = 'executing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Expired = 'expired',
  Invalidated = 'invalidated'
}
export const actionProposalStatusValidator = literals(...Object.values(ActionProposalStatus))

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
  Stale = 'stale'
}
export const approvalStatusValidator = literals(...Object.values(ApprovalStatus))

// ===== Document shapes (for query/mutation return validators) =====
export const employeeValidator = v.object({
  _id: v.id('employees'),
  _creationTime: v.number(),
  name: v.string(),
  email: v.string(),
  role: roleValidator,
  level: levelValidator,
  department: departmentValidator,
  status: employeeStatusValidator
})

export const resourceValidator = v.object({
  _id: v.id('resources'),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  type: resourceTypeValidator,
  sensitive: v.boolean()
})

export const permissionValidator = v.object({
  _id: v.id('permissions'),
  _creationTime: v.number(),
  employeeId: v.id('employees'),
  resourceId: v.id('resources'),
  accessLevel: accessLevelValidator,
  grantedAt: v.number()
})

export const policyValidator = v.object({
  _id: v.id('policies'),
  _creationTime: v.number(),
  key: v.string(),
  version: v.number(),
  title: v.string(),
  description: v.string(),
  content: v.string(),
  status: policyStatusValidator,
  createdAt: v.number()
})

export const policyRuleValidator = v.object({
  _id: v.id('policyRules'),
  _creationTime: v.number(),
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
})

export const approvalValidator = v.object({
  _id: v.id('approvals'),
  _creationTime: v.number(),
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

export const auditLogValidator = v.object({
  _id: v.id('auditLogs'),
  _creationTime: v.number(),
  action: v.string(),
  employeeId: v.optional(v.id('employees')),
  resourceId: v.optional(v.id('resources')),
  status: auditStatusValidator,
  source: auditSourceValidator,
  actorId: v.optional(v.string()),
  proposalId: v.optional(v.id('actionProposals')),
  approvalId: v.optional(v.id('approvals')),
  metadata: v.optional(v.any()),
  createdAt: v.number()
})
