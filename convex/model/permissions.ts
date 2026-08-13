import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import { classifyAccessChange, isApprovalRequired } from '../domain/access'
import type { PolicyEvidence } from '../domain/policyEngine'
import { resolveDemoActor } from '../domain/identity'
import type {
  AccessLevel } from '../helpers/validators'
import {
  AccessChangeType,
  AccessOperation,
  ApprovalStatus,
  AuditSource,
  AuditStatus
} from '../helpers/validators'
import { createOrReuseApproval } from './approvals'
import { recordAudit } from './audit'
import {
  evaluateCurrentPolicies,
  policyEvidenceIds,
  samePolicyEvidence
} from './policies'

type TrustedRequest = {
  employeeId: Id<'employees'>
  resourceId: Id<'resources'>
  source: AuditSource
  actorId: string
  proposalId?: Id<'actionProposals'>
}

async function loadAccessContext(ctx: MutationCtx, request: TrustedRequest) {
  const employee = await ctx.db.get(request.employeeId)

  if (!employee) {
    throw new ConvexError('Employee not found')
  }

  const resource = await ctx.db.get(request.resourceId)

  if (!resource) {
    throw new ConvexError('Resource not found')
  }

  const permission = await ctx.db
    .query('permissions')
    .withIndex('by_employee_resource', q => q
      .eq('employeeId', request.employeeId)
      .eq('resourceId', request.resourceId))
    .unique()

  return { employee, resource, permission }
}

function accessAction(changeType: AccessChangeType) {
  switch (changeType) {
    case AccessChangeType.Grant:
      return 'access_granted'
    case AccessChangeType.Upgrade:
      return 'access_upgraded'
    case AccessChangeType.Downgrade:
      return 'access_downgraded'
    case AccessChangeType.Revoke:
      return 'access_revoked'
    case AccessChangeType.Unchanged:
      return 'access_unchanged'
  }
}

async function commitSetAccessLevel(
  ctx: MutationCtx,
  permission: Doc<'permissions'> | null,
  request: Pick<TrustedRequest, 'employeeId' | 'resourceId'> & { targetLevel: AccessLevel },
  now = Date.now()
) {
  if (permission) {
    await ctx.db.patch(permission._id, {
      accessLevel: request.targetLevel,
      grantedAt: now
    })
  } else {
    await ctx.db.insert('permissions', {
      employeeId: request.employeeId,
      resourceId: request.resourceId,
      accessLevel: request.targetLevel,
      grantedAt: now
    })
  }
}

async function commitRevokeAccess(ctx: MutationCtx, permission: Doc<'permissions'>) {
  await ctx.db.delete(permission._id)
}

async function requestApproval(ctx: MutationCtx, args: TrustedRequest & {
  operation: AccessOperation
  fromLevel: AccessLevel | null
  targetLevel: AccessLevel | null
  changeType: AccessChangeType
  policyEvidence: Array<PolicyEvidence & { policyId: Id<'policies'> }>
}) {
  const result = await createOrReuseApproval(ctx, {
    operation: args.operation,
    employeeId: args.employeeId,
    resourceId: args.resourceId,
    fromLevel: args.fromLevel,
    targetLevel: args.targetLevel,
    changeType: args.changeType,
    policyEvidence: args.policyEvidence,
    requestedBy: args.actorId,
    requestedSource: args.source
  })

  if (result.created) {
    await ctx.scheduler.runAt(
      result.approval.expiresAt,
      internal.approvals.expire,
      { approvalId: result.approval._id }
    )
  }

  return result.approval
}

export async function listPermissions(ctx: QueryCtx) {
  const permissions = await ctx.db.query('permissions').collect()

  return await Promise.all(permissions.map(async (permission) => {
    const [employee, resource] = await Promise.all([
      ctx.db.get(permission.employeeId),
      ctx.db.get(permission.resourceId)
    ])

    return { ...permission, employee, resource }
  }))
}

export async function runSetAccessLevel(ctx: MutationCtx, args: TrustedRequest & {
  targetLevel: AccessLevel
}) {
  const { employee, resource, permission } = await loadAccessContext(ctx, args)
  const currentLevel = permission?.accessLevel ?? null
  const changeType = classifyAccessChange(currentLevel, args.targetLevel)
  const now = Date.now()

  if (changeType === AccessChangeType.Unchanged) {
    await recordAudit(ctx, {
      action: accessAction(changeType),
      status: AuditStatus.Success,
      source: args.source,
      actorId: args.actorId,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      proposalId: args.proposalId,
      metadata: {
        currentLevel,
        targetLevel: args.targetLevel,
        changeType,
        reason: 'already_at_target_level'
      },
      createdAt: now
    })

    return {
      status: 'unchanged' as const,
      changeType,
      currentLevel,
      targetLevel: args.targetLevel
    }
  }

  const policy = await evaluateCurrentPolicies(ctx, {
    operation: AccessOperation.SetAccessLevel,
    changeType,
    fromLevel: currentLevel,
    targetLevel: args.targetLevel,
    employee,
    resource
  })

  if (policy.decision === 'deny') {
    await recordAudit(ctx, {
      action: 'access_policy_denied',
      status: AuditStatus.Rejected,
      source: args.source,
      actorId: args.actorId,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      proposalId: args.proposalId,
      metadata: { operation: AccessOperation.SetAccessLevel, changeType, currentLevel, targetLevel: args.targetLevel, policy },
      createdAt: now
    })

    return { status: 'policy_denied' as const, changeType, fromLevel: currentLevel, targetLevel: args.targetLevel, policy }
  }

  const policyEvidence = policyEvidenceIds(policy)

  if (isApprovalRequired(resource)) {
    const approval = await requestApproval(ctx, {
      ...args,
      operation: AccessOperation.SetAccessLevel,
      fromLevel: currentLevel,
      targetLevel: args.targetLevel,
      changeType,
      policyEvidence
    })

    return {
      status: 'approval_required' as const,
      changeType,
      fromLevel: currentLevel,
      targetLevel: args.targetLevel,
      approvalId: approval._id
    }
  }

  await commitSetAccessLevel(ctx, permission, args, now)
  await recordAudit(ctx, {
    action: accessAction(changeType),
    status: AuditStatus.Success,
    source: args.source,
    actorId: args.actorId,
    employeeId: args.employeeId,
    resourceId: args.resourceId,
    proposalId: args.proposalId,
    metadata: { fromLevel: currentLevel, targetLevel: args.targetLevel, changeType, policyEvidence },
    createdAt: now
  })

  return { status: 'applied' as const, changeType, fromLevel: currentLevel, targetLevel: args.targetLevel }
}

export async function runRevokeAccess(ctx: MutationCtx, args: TrustedRequest) {
  const { employee, resource, permission } = await loadAccessContext(ctx, args)

  if (!permission) {
    throw new ConvexError('This employee does not have access to this resource')
  }

  const policy = await evaluateCurrentPolicies(ctx, {
    operation: AccessOperation.RevokeAccess,
    changeType: AccessChangeType.Revoke,
    fromLevel: permission.accessLevel,
    targetLevel: null,
    employee,
    resource
  })
  const now = Date.now()

  if (policy.decision === 'deny') {
    await recordAudit(ctx, {
      action: 'access_policy_denied',
      status: AuditStatus.Rejected,
      source: args.source,
      actorId: args.actorId,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      proposalId: args.proposalId,
      metadata: { operation: AccessOperation.RevokeAccess, changeType: AccessChangeType.Revoke, fromLevel: permission.accessLevel, targetLevel: null, policy },
      createdAt: now
    })

    return { status: 'policy_denied' as const, changeType: AccessChangeType.Revoke, fromLevel: permission.accessLevel, targetLevel: null, policy }
  }

  const policyEvidence = policyEvidenceIds(policy)

  if (isApprovalRequired(resource)) {
    const approval = await requestApproval(ctx, {
      ...args,
      operation: AccessOperation.RevokeAccess,
      fromLevel: permission.accessLevel,
      targetLevel: null,
      changeType: AccessChangeType.Revoke,
      policyEvidence
    })

    return {
      status: 'approval_required' as const,
      changeType: AccessChangeType.Revoke,
      fromLevel: permission.accessLevel,
      targetLevel: null,
      approvalId: approval._id
    }
  }

  await commitRevokeAccess(ctx, permission)
  await recordAudit(ctx, {
    action: accessAction(AccessChangeType.Revoke),
    status: AuditStatus.Success,
    source: args.source,
    actorId: args.actorId,
    employeeId: args.employeeId,
    resourceId: args.resourceId,
    proposalId: args.proposalId,
    metadata: { fromLevel: permission.accessLevel, targetLevel: null, changeType: AccessChangeType.Revoke, policyEvidence },
    createdAt: now
  })

  return { status: 'applied' as const, changeType: AccessChangeType.Revoke, fromLevel: permission.accessLevel, targetLevel: null }
}

export async function executeApprovedTransition(ctx: MutationCtx, approvalId: Id<'approvals'>) {
  const decisionActor = resolveDemoActor(AuditSource.Admin)
  const approval = await ctx.db.get(approvalId)

  if (!approval || approval.status !== ApprovalStatus.Pending) {
    throw new ConvexError('Pending approval not found')
  }

  const now = Date.now()

  if (approval.expiresAt <= now) {
    await ctx.db.patch(approvalId, {
      status: ApprovalStatus.Expired,
      decidedBy: decisionActor.actorId,
      decidedAt: now,
      decisionReason: 'expired'
    })
    await recordAudit(ctx, {
      action: 'approval_expired',
      status: AuditStatus.Rejected,
      source: decisionActor.source,
      actorId: decisionActor.actorId,
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      approvalId,
      metadata: { reason: 'approval_ttl_elapsed' },
      createdAt: now
    })
    return { status: 'expired' as const }
  }

  const { employee, resource, permission } = await loadAccessContext(ctx, {
    employeeId: approval.employeeId,
    resourceId: approval.resourceId,
    source: approval.requestedSource,
    actorId: approval.requestedBy
  })
  const currentLevel = permission?.accessLevel ?? null

  if (currentLevel !== approval.fromLevel) {
    await ctx.db.patch(approvalId, {
      status: ApprovalStatus.Stale,
      decidedBy: decisionActor.actorId,
      decidedAt: now,
      decisionReason: 'current_access_changed'
    })
    await recordAudit(ctx, {
      action: 'approval_stale',
      status: AuditStatus.Rejected,
      source: decisionActor.source,
      actorId: decisionActor.actorId,
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      approvalId,
      metadata: { expectedFromLevel: approval.fromLevel, actualFromLevel: currentLevel },
      createdAt: now
    })
    return { status: 'stale' as const }
  }

  const policy = await evaluateCurrentPolicies(ctx, {
    operation: approval.operation,
    changeType: approval.changeType,
    fromLevel: approval.fromLevel,
    targetLevel: approval.targetLevel,
    employee,
    resource
  })
  const currentEvidence = policyEvidenceIds(policy)

  if (policy.decision === 'deny' || !samePolicyEvidence(approval.policyEvidence, currentEvidence)) {
    await ctx.db.patch(approvalId, {
      status: ApprovalStatus.Stale,
      decidedBy: decisionActor.actorId,
      decidedAt: now,
      decisionReason: 'policy_changed'
    })
    await recordAudit(ctx, {
      action: policy.decision === 'deny' ? 'approval_policy_denied' : 'approval_policy_changed',
      status: AuditStatus.Rejected,
      source: decisionActor.source,
      actorId: decisionActor.actorId,
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      approvalId,
      metadata: { policy },
      createdAt: now
    })
    return { status: 'policy_denied' as const }
  }

  if (approval.operation === AccessOperation.SetAccessLevel) {
    if (approval.targetLevel === null) {
      throw new Error('set_access_level approval is missing targetLevel')
    }
    await commitSetAccessLevel(ctx, permission, {
      employeeId: approval.employeeId,
      resourceId: approval.resourceId,
      targetLevel: approval.targetLevel
    }, now)
  } else {
    if (!permission) {
      throw new Error('revoke_access approval no longer has a permission')
    }
    await commitRevokeAccess(ctx, permission)
  }

  await ctx.db.patch(approvalId, {
    status: ApprovalStatus.Approved,
    decidedBy: decisionActor.actorId,
    decidedAt: now,
    decisionReason: 'approved'
  })
  await recordAudit(ctx, {
    action: accessAction(approval.changeType),
    status: AuditStatus.Success,
    source: approval.requestedSource,
    actorId: approval.requestedBy,
    employeeId: approval.employeeId,
    resourceId: approval.resourceId,
    approvalId,
    metadata: {
      fromLevel: approval.fromLevel,
      targetLevel: approval.targetLevel,
      changeType: approval.changeType,
      approvedBy: decisionActor.actorId,
      policyEvidence: currentEvidence
    },
    createdAt: now
  })
  await recordAudit(ctx, {
    action: 'approval_approved',
    status: AuditStatus.Success,
    source: decisionActor.source,
    actorId: decisionActor.actorId,
    employeeId: approval.employeeId,
    resourceId: approval.resourceId,
    approvalId,
    metadata: { requestedBy: approval.requestedBy, requestedSource: approval.requestedSource },
    createdAt: now
  })

  return { status: 'applied' as const, changeType: approval.changeType }
}

export async function seedPermissionSnapshot(ctx: MutationCtx, args: {
  employeeId: Id<'employees'>
  resourceId: Id<'resources'>
  accessLevel: AccessLevel
}) {
  const existing = await ctx.db
    .query('permissions')
    .withIndex('by_employee_resource', q => q
      .eq('employeeId', args.employeeId)
      .eq('resourceId', args.resourceId))
    .unique()

  if (!existing) {
    await commitSetAccessLevel(ctx, null, {
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      targetLevel: args.accessLevel
    })
  }
}
