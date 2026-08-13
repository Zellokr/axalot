import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  ApprovalStatus,
  AuditStatus,
  type AccessChangeType,
  type AccessLevel,
  type AccessOperation,
  type AuditSource
} from '../helpers/validators'
import type { PolicyEvidence } from '../domain/policyEngine'
import { recordAudit } from './audit'
import { samePolicyEvidence } from './policies'

export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000

type ApprovalTransition = {
  operation: AccessOperation
  employeeId: Id<'employees'>
  resourceId: Id<'resources'>
  fromLevel: AccessLevel | null
  targetLevel: AccessLevel | null
  changeType: AccessChangeType
  policyEvidence: Array<PolicyEvidence & { policyId: Id<'policies'> }>
}

function sameTransition(
  approval: {
    operation: AccessOperation
    fromLevel: AccessLevel | null
    targetLevel: AccessLevel | null
    changeType: AccessChangeType
  },
  transition: ApprovalTransition
) {
  return approval.operation === transition.operation
    && approval.fromLevel === transition.fromLevel
    && approval.targetLevel === transition.targetLevel
    && approval.changeType === transition.changeType
}

export async function createOrReuseApproval(ctx: MutationCtx, args: ApprovalTransition & {
  requestedBy: string
  requestedSource: AuditSource
}) {
  const now = Date.now()
  const pending = await ctx.db
    .query('approvals')
    .withIndex('by_employee_resource_status', q => q
      .eq('employeeId', args.employeeId)
      .eq('resourceId', args.resourceId)
      .eq('status', ApprovalStatus.Pending))
    .collect()

  for (const approval of pending) {
    if (approval.expiresAt <= now) {
      await ctx.db.patch(approval._id, {
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
      continue
    }

    if (sameTransition(approval, args)
      && !samePolicyEvidence(approval.policyEvidence, args.policyEvidence)) {
      await ctx.db.patch(approval._id, {
        status: ApprovalStatus.Stale,
        decidedAt: now,
        decisionReason: 'policy_changed'
      })
      await recordAudit(ctx, {
        action: 'approval_policy_changed',
        status: AuditStatus.Rejected,
        source: args.requestedSource,
        actorId: args.requestedBy,
        employeeId: args.employeeId,
        resourceId: args.resourceId,
        approvalId: approval._id,
        metadata: { reason: 'policy_evidence_changed_before_reuse' },
        createdAt: now
      })
      continue
    }

    if (sameTransition(approval, args)) {
      await recordAudit(ctx, {
        action: 'approval_reused',
        status: AuditStatus.Pending,
        source: args.requestedSource,
        actorId: args.requestedBy,
        employeeId: args.employeeId,
        resourceId: args.resourceId,
        approvalId: approval._id,
        metadata: {
          operation: args.operation,
          fromLevel: args.fromLevel,
          targetLevel: args.targetLevel,
          changeType: args.changeType
        },
        createdAt: now
      })

      return { approval, created: false }
    }
  }

  const approvalId = await ctx.db.insert('approvals', {
    ...args,
    status: ApprovalStatus.Pending,
    createdAt: now,
    expiresAt: now + APPROVAL_TTL_MS
  })
  const approval = await ctx.db.get(approvalId)

  if (!approval) {
    throw new Error('Approval was not persisted.')
  }

  await recordAudit(ctx, {
    action: 'approval_created',
    status: AuditStatus.Pending,
    source: args.requestedSource,
    actorId: args.requestedBy,
    employeeId: args.employeeId,
    resourceId: args.resourceId,
    approvalId,
    metadata: {
      operation: args.operation,
      fromLevel: args.fromLevel,
      targetLevel: args.targetLevel,
      changeType: args.changeType,
      expiresAt: approval.expiresAt
    },
    createdAt: now
  })

  return { approval, created: true }
}
