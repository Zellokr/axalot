import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { AuditStatus, type AccessLevel, type AuditSource } from '../helpers/validators'

export async function listPermissions(ctx: QueryCtx) {
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

export async function grantAccess(ctx: MutationCtx, args: {
  employeeId: Id<'employees'>
  resourceId: Id<'resources'>
  accessLevel: AccessLevel
  source: AuditSource
}) {
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

export async function revokeAccess(ctx: MutationCtx, args: {
  employeeId: Id<'employees'>
  resourceId: Id<'resources'>
  source: AuditSource
}) {
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
