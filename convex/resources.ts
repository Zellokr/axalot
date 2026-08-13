import { v } from 'convex/values'
import { query } from './_generated/server'
import { employeeValidator, permissionValidator, resourceValidator } from './helpers/validators'
import { getResourceDetails, listResources } from './model/resources'

export const list = query({
  args: {},
  returns: v.array(resourceValidator.extend({ permissionCount: v.number() })),

  handler: async (ctx) => {
    return await listResources(ctx)
  }
})

export const getDetails = query({
  args: {
    resourceId: v.string()
  },
  returns: v.union(
    v.null(),
    v.object({
      resource: resourceValidator,
      permissions: v.array(permissionValidator.extend({
        employee: v.union(v.null(), employeeValidator)
      }))
    })
  ),

  handler: async (ctx, args) => {
    return await getResourceDetails(ctx, args.resourceId)
  }
})
