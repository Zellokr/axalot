import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { accessLevelValidator, auditSourceValidator, employeeValidator, permissionValidator, resourceValidator } from './helpers/validators'
import { grantAccess as grantAccessModel, listPermissions, revokeAccess as revokeAccessModel } from './model/permissions'

export const list = query({
  args: {},
  returns: v.array(permissionValidator.extend({
    employee: v.union(v.null(), employeeValidator),
    resource: v.union(v.null(), resourceValidator)
  })),

  handler: async (ctx) => {
    return await listPermissions(ctx)
  }
})

export const grantAccess = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    accessLevel: accessLevelValidator,
    source: auditSourceValidator
  },
  returns: v.null(),

  handler: async (ctx, args) => {
    await grantAccessModel(ctx, args)
    return null
  }
})

export const revokeAccess = mutation({
  args: {
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    source: auditSourceValidator
  },
  returns: v.null(),

  handler: async (ctx, args) => {
    await revokeAccessModel(ctx, args)
    return null
  }
})
