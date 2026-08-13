import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { AuditSource, AuditStatus } from '../helpers/validators'

export async function recordAudit(ctx: MutationCtx, event: {
  action: string
  status: AuditStatus
  source: AuditSource
  actorId: string
  employeeId?: Id<'employees'>
  resourceId?: Id<'resources'>
  proposalId?: Id<'actionProposals'>
  approvalId?: Id<'approvals'>
  metadata?: unknown
  createdAt?: number
}) {
  return await ctx.db.insert('auditLogs', {
    action: event.action,
    status: event.status,
    source: event.source,
    actorId: event.actorId,
    employeeId: event.employeeId,
    resourceId: event.resourceId,
    proposalId: event.proposalId,
    approvalId: event.approvalId,
    metadata: event.metadata,
    createdAt: event.createdAt ?? Date.now()
  })
}
