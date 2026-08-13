import { query } from './_generated/server'

export const overview = query({
  args: {},

  handler: async (ctx) => {
    const [employees, resources, permissions, auditLogs] = await Promise.all([
      ctx.db.query('employees').collect(),
      ctx.db.query('resources').collect(),
      ctx.db.query('permissions').collect(),
      ctx.db
        .query('auditLogs')
        .withIndex('by_created_at')
        .order('desc')
        .collect()
    ])

    return {
      stats: {
        employees: employees.length,
        resources: resources.length,
        permissions: permissions.length,
        auditEvents: auditLogs.length
      },
      recentActivity: auditLogs.slice(0, 5)
    }
  }
})
