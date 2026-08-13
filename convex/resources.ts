import { query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},

  handler: async (ctx) => {
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
})

export const getDetails = query({
  args: {
    resourceId: v.string()
  },

  handler: async (ctx, args) => {
    const resourceId = ctx.db.normalizeId(
      'resources',
      args.resourceId
    )

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
})
