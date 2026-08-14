import { ConvexError, v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { resolveDemoActor } from './domain/identity'
import { executeApprovedTransition } from './model/permissions'
import { getLatestApproval, listApprovals } from './model/approvals'
import {
  approvalValidator,
  employeeValidator,
  resourceValidator,
  ApprovalStatus,
  AuditSource,
  AuditStatus
} from './helpers/validators'
import { recordAudit } from './model/audit'

export const list = query({
  args: {},
  returns: v.array(approvalValidator.extend({
    employee: v.union(v.null(), employeeValidator),
    resource: v.union(v.null(), resourceValidator)
  })),
  handler: async ctx => await listApprovals(ctx)
})

export const getStatusForAgent = internalQuery({
  args: { employeeId: v.id('employees'), resourceId: v.id('resources') },
  returns: v.union(v.null(), approvalValidator),
  handler: async (ctx, args) => await getLatestApproval(ctx, args.employeeId, args.resourceId)
})

export const approve = mutation({
  args: { approvalId: v.id('approvals') },
  returns: v.any(),
  handler: async (ctx, args) => await executeApprovedTransition(ctx, args.approvalId)
})

export const reject = mutation({
  args: { approvalId: v.id('approvals') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId)

    if (!approval || approval.status !== ApprovalStatus.Pending) {
      throw new ConvexError('Pending approval not found')
    }

    const identity = resolveDemoActor(AuditSource.Admin)
    const now = Date.now()

    if (approval.expiresAt <= now) {
      await ctx.db.patch(args.approvalId, {
        status: ApprovalStatus.Expired,
        decidedBy: identity.actorId,
        decidedAt: now,
        decisionReason: 'expired'
      })
      await recordAudit(ctx, {
        action: 'approval_expired',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: approval.employeeId,
        resourceId: approval.resourceId,
        approvalId: approval._id,
        metadata: { reason: 'approval_ttl_elapsed' },
        createdAt: now
      })
      return { status: 'expired' }
    }

    await ctx.db.patch(args.approvalId, {
      status: ApprovalStatus.Rejected,
      decidedBy: identity.actorId,
      decidedAt: now,
      decisionReason: 'rejected_by_admin'
    })
    await recordAudit(ctx, {
      action: 'approval_rejected',
      status: AuditStatus.Rejected,
      source: identity.source,
      actorId: identity.actorId,
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      approvalId: approval._id,
      createdAt: now
    })
    return { status: 'rejected' }
  }
})

export const expire = internalMutation({
  args: { approvalId: v.id('approvals') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId)

    if (!approval || approval.status !== ApprovalStatus.Pending || approval.expiresAt > Date.now()) {
      return null
    }

    const now = Date.now()
    await ctx.db.patch(args.approvalId, {
      status: ApprovalStatus.Expired,
      decidedAt: now,
      decisionReason: 'expired'
    })
    await recordAudit(ctx, {
      action: 'approval_expired',
      status: AuditStatus.Rejected,
      source: approval.requestedSource,
      actorId: approval.requestedBy,
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      approvalId: approval._id,
      metadata: { reason: 'approval_ttl_elapsed' },
      createdAt: now
    })
    return null
  }
})
