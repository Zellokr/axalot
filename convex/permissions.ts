import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { AuditStatus, accessLevelValidator, auditSourceValidator } from './helpers/validators'

export const list = query({
  args: {},

  handler: async (ctx) => {
    const permissions = await ctx.db
      .query('permissions')
      .collect()

    return await Promise.all(
      permissions.map(async (permission) => {
        const [employee, resource] = await Promise.all([
          ctx.db.get(permission.employeeId),
          ctx.db.get(permission.resourceId)
        ])

        return {
          ...permission,
          employee,
          resource
        }
      })
    )
  }
})

export const grantAccess = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    accessLevel: accessLevelValidator,
    source: auditSourceValidator
  },

  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId)

    if (!employee) {
      throw new ConvexError('Employee not found')
    }

    const resource = await ctx.db.get(args.resourceId)

    if (!resource) {
      throw new ConvexError('Resource not found')
    }

    const existing = await ctx.db
      .query('permissions')
      .withIndex('by_employee_resource', q =>
        q
          .eq('employeeId', args.employeeId)
          .eq('resourceId', args.resourceId)
      )
      .unique()

    const grantedAt = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessLevel: args.accessLevel,
        grantedAt
      })
    } else {
      await ctx.db.insert('permissions', {
        employeeId: args.employeeId,
        resourceId: args.resourceId,
        accessLevel: args.accessLevel,
        grantedAt
      })
    }

    await ctx.db.insert('auditLogs', {
      action: `Granted ${args.accessLevel} access to ${resource.name}`,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      status: AuditStatus.Success,
      source: args.source,
      metadata: {
        accessLevel: args.accessLevel,
        previousAccessLevel: existing?.accessLevel ?? null
      },
      createdAt: grantedAt
    })
  }
})

export const revokeAccess = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    source: auditSourceValidator
  },

  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId)

    if (!resource) {
      throw new ConvexError('Resource not found')
    }

    const existing = await ctx.db
      .query('permissions')
      .withIndex('by_employee_resource', q =>
        q
          .eq('employeeId', args.employeeId)
          .eq('resourceId', args.resourceId)
      )
      .unique()

    if (!existing) {
      throw new ConvexError('This employee does not have access to this resource')
    }

    await ctx.db.delete(existing._id)

    await ctx.db.insert('auditLogs', {
      action: `Revoked ${existing.accessLevel} access to ${resource.name}`,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      status: AuditStatus.Success,
      source: args.source,
      metadata: {
        revokedAccessLevel: existing.accessLevel
      },
      createdAt: Date.now()
    })
  }
})
