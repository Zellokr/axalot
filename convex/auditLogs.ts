import { v } from 'convex/values'
import { query } from './_generated/server'
import { auditLogValidator, employeeValidator, resourceValidator } from './helpers/validators'
import { listAuditLogs } from './model/auditLogs'

export const list = query({
  args: {},
  returns: v.array(auditLogValidator.extend({
    employee: v.union(v.null(), employeeValidator),
    resource: v.union(v.null(), resourceValidator)
  })),

  handler: async (ctx) => {
    return await listAuditLogs(ctx)
  }
})
