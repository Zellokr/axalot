import { v } from 'convex/values'
import { query } from './_generated/server'
import { auditLogValidator } from './helpers/validators'
import { getOverview } from './model/dashboard'

export const overview = query({
  args: {},
  returns: v.object({
    stats: v.object({
      employees: v.number(),
      resources: v.number(),
      permissions: v.number(),
      auditEvents: v.number()
    }),
    recentActivity: v.array(auditLogValidator)
  }),

  handler: async (ctx) => {
    return await getOverview(ctx)
  }
})
