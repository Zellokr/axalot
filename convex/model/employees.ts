import type { QueryCtx } from '../_generated/server'
import type { Department, EmployeeStatus, Level, Role } from '../helpers/validators'

export type EmployeeFilters = {
  role?: Role
  level?: Level
  department?: Department
  status?: EmployeeStatus
}

export async function listEmployees(ctx: QueryCtx, filters: EmployeeFilters = {}) {
  const employees = filters.department
    ? await ctx.db
        .query('employees')
        .withIndex('by_department', q => q.eq('department', filters.department!))
        .collect()
    : await ctx.db.query('employees').collect()

  return employees.filter(employee =>
    (filters.role === undefined || employee.role === filters.role)
    && (filters.level === undefined || employee.level === filters.level)
    && (filters.status === undefined || employee.status === filters.status))
}

export async function getEmployeeDetails(ctx: QueryCtx, rawEmployeeId: string) {
  const employeeId = ctx.db.normalizeId('employees', rawEmployeeId)

  if (!employeeId) {
    return null
  }

  const employee = await ctx.db.get(employeeId)

  if (!employee) {
    return null
  }

  const [resources, permissions] = await Promise.all([
    ctx.db.query('resources').collect(),
    ctx.db
      .query('permissions')
      .withIndex('by_employee_resource', q =>
        q.eq('employeeId', employeeId)
      )
      .collect()
  ])

  const permissionByResource = new Map(
    permissions.map(permission => [permission.resourceId, permission])
  )

  const access = resources.map(resource => ({
    resource,
    permission: permissionByResource.get(resource._id) ?? null
  }))

  return {
    employee,
    access,
    activePermissions: permissions.length,
    totalResources: resources.length
  }
}
