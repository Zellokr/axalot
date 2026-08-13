import type { QueryCtx } from '../_generated/server'

export async function listAuditLogs(ctx: QueryCtx) {
  const logs = await ctx.db
    .query('auditLogs')
    .withIndex('by_created_at')
    .order('desc')
    .collect()

  return await Promise.all(
    logs.map(async (log) => {
      const [employee, resource] = await Promise.all([
        log.employeeId ? ctx.db.get(log.employeeId) : null,
        log.resourceId ? ctx.db.get(log.resourceId) : null
      ])

      return {
        ...log,
        employee,
        resource
      }
    })
  )
}
