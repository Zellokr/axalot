import { query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},

  handler: async (ctx) => {
    return await ctx.db
      .query('employees')
      .collect()
  }
})

export const getDetails = query({
  args: {
    employeeId: v.string()
  },

  handler: async (ctx, args) => {
    const employeeId = ctx.db.normalizeId(
      'employees',
      args.employeeId
    )

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
        .withIndex('by_employee', q =>
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
})
