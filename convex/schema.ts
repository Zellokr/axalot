import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  accessLevelValidator,
  auditStatusValidator,
  auditSourceValidator,
  departmentValidator,
  employeeStatusValidator,
  levelValidator,
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

    metadata: v.optional(v.any()),

    createdAt: v.number()
  })
    .index('by_created_at', ['createdAt'])
})
