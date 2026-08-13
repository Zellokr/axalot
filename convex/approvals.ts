import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { resolveDemoActor } from './domain/identity'
import { executeApprovedTransition } from './model/permissions'
import {
  ApprovalStatus,
  AuditSource,
  AuditStatus
} from './helpers/validators'
import { recordAudit } from './model/audit'

export const list = query({
  args: {},
  returns: v.any(),
  handler: async ctx => await ctx.db.query('approvals').order('desc').collect()
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
