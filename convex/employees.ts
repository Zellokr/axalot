import { v } from 'convex/values'
import { internalQuery, query } from './_generated/server'
import {
  departmentValidator,
  employeeStatusValidator,
  employeeValidator,
  levelValidator,
  permissionValidator,
  resourceValidator,
  roleValidator
} from './helpers/validators'
import { getEmployeeDetails, listEmployees } from './model/employees'

export const list = query({
  args: {
    role: v.optional(roleValidator),
    level: v.optional(levelValidator),
    department: v.optional(departmentValidator),
    status: v.optional(employeeStatusValidator)
  },
  returns: v.array(employeeValidator),

  handler: async (ctx, args) => {
    return await listEmployees(ctx, args)
  }
})

export const listForAgent = internalQuery({
  args: {
    role: v.optional(roleValidator),
    level: v.optional(levelValidator),
    department: v.optional(departmentValidator),
    status: v.optional(employeeStatusValidator)
  },
  returns: v.array(employeeValidator),

  handler: async (ctx, args) => {
    return await listEmployees(ctx, args)
  }
})

export const getDetails = query({
  args: {
    employeeId: v.string()
  },
  returns: v.union(
    v.null(),
    v.object({
      employee: employeeValidator,
      access: v.array(v.object({
        resource: resourceValidator,
        permission: v.union(v.null(), permissionValidator)
      })),
      activePermissions: v.number(),
      totalResources: v.number()
    })
  ),

  handler: async (ctx, args) => {
    return await getEmployeeDetails(ctx, args.employeeId)
  }
})
