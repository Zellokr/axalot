import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { resolveDemoActor } from './domain/identity'
import {
  accessLevelValidator,
  AuditSource,
  employeeValidator,
  permissionValidator,
  resourceValidator
} from './helpers/validators'
import {
  listPermissions,
  runRevokeAccess,
  runSetAccessLevel
} from './model/permissions'

export const list = query({
  args: {},
  returns: v.array(permissionValidator.extend({
    employee: v.union(v.null(), employeeValidator),
    resource: v.union(v.null(), resourceValidator)
  })),
  handler: async ctx => await listPermissions(ctx)
})

export const setAccessLevel = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    targetLevel: accessLevelValidator
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Admin)
    return await runSetAccessLevel(ctx, { ...args, ...identity })
  }
})

export const revokeAccess = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources')
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Admin)
    return await runRevokeAccess(ctx, { ...args, ...identity })
  }
})

export const setAccessLevelFromAgent = internalMutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    targetLevel: accessLevelValidator,
    proposalId: v.optional(v.id('actionProposals'))
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    return await runSetAccessLevel(ctx, { ...args, ...identity })
  }
})

export const revokeAccessFromAgent = internalMutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    proposalId: v.optional(v.id('actionProposals'))
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    return await runRevokeAccess(ctx, { ...args, ...identity })
  }
})
