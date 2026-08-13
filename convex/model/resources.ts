import type { QueryCtx } from '../_generated/server'

export async function listResources(ctx: QueryCtx) {
  const resources = await ctx.db
    .query('resources')
    .collect()

  return await Promise.all(
    resources.map(async (resource) => {
      const permissions = await ctx.db
        .query('permissions')
        .withIndex('by_resource', q =>
          q.eq('resourceId', resource._id)
        )
        .collect()

      return {
        ...resource,
        permissionCount: permissions.length
      }
    })
  )
}

export async function getResourceDetails(ctx: QueryCtx, rawResourceId: string) {
  const resourceId = ctx.db.normalizeId('resources', rawResourceId)

  if (!resourceId) {
    return null
  }

  const resource = await ctx.db.get(resourceId)

  if (!resource) {
    return null
  }

  const permissions = await ctx.db
    .query('permissions')
    .withIndex('by_resource', q =>
      q.eq('resourceId', resourceId)
    )
    .collect()

  const permissionsWithEmployees = await Promise.all(
    permissions.map(async (permission) => {
      const employee = await ctx.db.get(permission.employeeId)

      return {
        ...permission,
        employee
      }
    })
  )

  return {
    resource,
    permissions: permissionsWithEmployees
  }
}
