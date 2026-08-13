import type { QueryCtx } from '../_generated/server'

export async function listEmployees(ctx: QueryCtx) {
  return await ctx.db
    .query('employees')
    .collect()
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
