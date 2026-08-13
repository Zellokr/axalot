import { literals } from 'convex-helpers/validators'

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
