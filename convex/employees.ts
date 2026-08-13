import { v } from 'convex/values'
import { query } from './_generated/server'
import { employeeValidator, permissionValidator, resourceValidator } from './helpers/validators'
import { getEmployeeDetails, listEmployees } from './model/employees'

export const list = query({
  args: {},
  returns: v.array(employeeValidator),

  handler: async (ctx) => {
    return await listEmployees(ctx)
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
