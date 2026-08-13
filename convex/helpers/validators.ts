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

export const auditLogValidator = v.object({
  _id: v.id('auditLogs'),
  _creationTime: v.number(),
  action: v.string(),
  employeeId: v.optional(v.id('employees')),
  resourceId: v.optional(v.id('resources')),
  status: auditStatusValidator,
  source: auditSourceValidator,
  metadata: v.optional(v.any()),
  createdAt: v.number()
})
