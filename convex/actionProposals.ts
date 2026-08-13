import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { classifyAccessChange } from './domain/access'
import { DEMO_ADMIN_ID, resolveDemoActor } from './domain/identity'
import {
  AccessChangeType,
  AccessOperation,
  ActionProposalStatus,
  accessLevelValidator,
  accessOperationValidator,
  AuditSource,
  AuditStatus
} from './helpers/validators'
import { recordAudit } from './model/audit'
import {
  evaluateCurrentPolicies,
  policyEvidenceIds,
  samePolicyEvidence
} from './model/policies'
import {
  runRevokeAccess,
  runSetAccessLevel
} from './model/permissions'

export const ACTION_PROPOSAL_TTL_MS = 10 * 60 * 1000

async function getConversation(ctx: Parameters<typeof recordAudit>[0]) {
  const conversation = await ctx.db
    .query('agentConversations')
    .withIndex('by_owner', q => q.eq('ownerId', DEMO_ADMIN_ID))
    .unique()

  if (!conversation) {
    throw new ConvexError('Agent conversation has not been initialized')
  }

  return conversation
}

async function expirePendingProposal(
  ctx: Parameters<typeof recordAudit>[0],
  proposal: NonNullable<Awaited<ReturnType<typeof ctx.db.get<'actionProposals'>>>>,
  now: number
) {
  await ctx.db.patch(proposal._id, {
    status: ActionProposalStatus.Expired,
    decidedAt: now,
    result: 'expired'
  })
  await recordAudit(ctx, {
    action: 'proposal_expired',
    status: AuditStatus.Rejected,
    source: proposal.requestedSource,
    actorId: proposal.requestedBy,
    employeeId: proposal.employeeId,
    resourceId: proposal.resourceId,
    proposalId: proposal._id,
    metadata: { reason: 'proposal_ttl_elapsed' },
    createdAt: now
  })
}

export const create = internalMutation({
  args: {
    operation: accessOperationValidator,
    employeeId: v.id('employees'),
    resourceId: v.id('resources'),
    targetLevel: v.optional(accessLevelValidator)
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    const conversation = await getConversation(ctx)
    const [employee, resource, permission] = await Promise.all([
      ctx.db.get(args.employeeId),
      ctx.db.get(args.resourceId),
      ctx.db
        .query('permissions')
        .withIndex('by_employee_resource', q => q
          .eq('employeeId', args.employeeId)
          .eq('resourceId', args.resourceId))
        .unique()
    ])

    if (!employee) {
      throw new ConvexError('Employee not found')
    }
    if (!resource) {
      throw new ConvexError('Resource not found')
    }

    const fromLevel = permission?.accessLevel ?? null
    let targetLevel = args.targetLevel ?? null
    let changeType: AccessChangeType

    if (args.operation === AccessOperation.SetAccessLevel) {
      if (!args.targetLevel) {
        throw new ConvexError('targetLevel is required for set_access_level')
      }
      changeType = classifyAccessChange(fromLevel, args.targetLevel)
      targetLevel = args.targetLevel

      if (changeType === AccessChangeType.Unchanged) {
        return await runSetAccessLevel(ctx, { ...args, targetLevel: args.targetLevel, ...identity })
      }
    } else {
      if (!permission) {
        throw new ConvexError('This employee does not have access to this resource')
      }
      if (args.targetLevel !== undefined) {
        throw new ConvexError('targetLevel is not accepted for revoke_access')
      }
      changeType = AccessChangeType.Revoke
    }

    const policy = await evaluateCurrentPolicies(ctx, {
      operation: args.operation,
      changeType,
      fromLevel,
      targetLevel,
      employee,
      resource
    })
    const now = Date.now()

    if (policy.decision === 'deny') {
      await recordAudit(ctx, {
        action: 'proposal_policy_denied',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: args.employeeId,
        resourceId: args.resourceId,
        metadata: { operation: args.operation, fromLevel, targetLevel, changeType, policy },
        createdAt: now
      })
      return { status: 'policy_denied', policy } as const
    }

    const pending = await ctx.db
      .query('actionProposals')
      .withIndex('by_conversation_status', q => q
        .eq('conversationId', conversation._id)
        .eq('status', ActionProposalStatus.PendingConfirmation))
      .collect()

    for (const previous of pending) {
      if (previous.expiresAt <= now) {
        await expirePendingProposal(ctx, previous, now)
        continue
      }

      await ctx.db.patch(previous._id, {
        status: ActionProposalStatus.Cancelled,
        decidedAt: now,
        result: 'superseded_by_new_proposal'
      })
      await recordAudit(ctx, {
        action: 'proposal_cancelled',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: previous.employeeId,
        resourceId: previous.resourceId,
        proposalId: previous._id,
        metadata: { reason: 'superseded_by_new_proposal' },
        createdAt: now
      })
    }

    const proposalId = await ctx.db.insert('actionProposals', {
      conversationId: conversation._id,
      operation: args.operation,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      fromLevel,
      targetLevel,
      changeType,
      policyEvidence: policyEvidenceIds(policy),
      requestedBy: identity.actorId,
      requestedSource: identity.source,
      status: ActionProposalStatus.PendingConfirmation,
      createdAt: now,
      expiresAt: now + ACTION_PROPOSAL_TTL_MS
    })

    await ctx.scheduler.runAt(now + ACTION_PROPOSAL_TTL_MS, internal.actionProposals.expire, { proposalId })
    await recordAudit(ctx, {
      action: 'proposal_created',
      status: AuditStatus.Pending,
      source: identity.source,
      actorId: identity.actorId,
      employeeId: args.employeeId,
      resourceId: args.resourceId,
      proposalId,
      metadata: { operation: args.operation, fromLevel, targetLevel, changeType, expiresAt: now + ACTION_PROPOSAL_TTL_MS },
      createdAt: now
    })

    return { status: 'pending_confirmation', proposalId, operation: args.operation, fromLevel, targetLevel, changeType } as const
  }
})

export const execute = internalMutation({
  args: { proposalId: v.id('actionProposals') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    const proposal = await ctx.db.get(args.proposalId)

    if (!proposal || proposal.status !== ActionProposalStatus.PendingConfirmation) {
      throw new ConvexError('Pending action proposal not found')
    }

    const now = Date.now()
    if (proposal.expiresAt <= now) {
      await expirePendingProposal(ctx, proposal, now)
      return { status: 'expired' } as const
    }

    const [employee, resource, permission] = await Promise.all([
      ctx.db.get(proposal.employeeId),
      ctx.db.get(proposal.resourceId),
      ctx.db
        .query('permissions')
        .withIndex('by_employee_resource', q => q
          .eq('employeeId', proposal.employeeId)
          .eq('resourceId', proposal.resourceId))
        .unique()
    ])

    if (!employee || !resource) {
      await ctx.db.patch(proposal._id, {
        status: ActionProposalStatus.Invalidated,
        decidedAt: now,
        result: 'target_missing'
      })
      await recordAudit(ctx, {
        action: 'proposal_invalidated',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: proposal.employeeId,
        resourceId: proposal.resourceId,
        proposalId: proposal._id,
        metadata: { reason: 'target_missing' },
        createdAt: now
      })
      return { status: 'invalidated', reason: 'target_missing' } as const
    }

    const currentLevel = permission?.accessLevel ?? null
    if (currentLevel !== proposal.fromLevel) {
      await ctx.db.patch(proposal._id, {
        status: ActionProposalStatus.Invalidated,
        decidedAt: now,
        result: 'stale_proposal'
      })
      await recordAudit(ctx, {
        action: 'proposal_stale',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: proposal.employeeId,
        resourceId: proposal.resourceId,
        proposalId: proposal._id,
        metadata: { expectedFromLevel: proposal.fromLevel, actualFromLevel: currentLevel },
        createdAt: now
      })
      return { status: 'invalidated', reason: 'stale_proposal' } as const
    }

    const policy = await evaluateCurrentPolicies(ctx, {
      operation: proposal.operation,
      changeType: proposal.changeType,
      fromLevel: proposal.fromLevel,
      targetLevel: proposal.targetLevel,
      employee,
      resource
    })
    const currentEvidence = policyEvidenceIds(policy)

    if (policy.decision === 'deny' || !samePolicyEvidence(proposal.policyEvidence, currentEvidence)) {
      await ctx.db.patch(proposal._id, {
        status: ActionProposalStatus.Invalidated,
        decidedAt: now,
        result: 'policy_changed'
      })
      await recordAudit(ctx, {
        action: 'proposal_policy_changed',
        status: AuditStatus.Rejected,
        source: identity.source,
        actorId: identity.actorId,
        employeeId: proposal.employeeId,
        resourceId: proposal.resourceId,
        proposalId: proposal._id,
        metadata: { policy },
        createdAt: now
      })
      return { status: 'invalidated', reason: 'policy_changed' } as const
    }

    await ctx.db.patch(proposal._id, { status: ActionProposalStatus.Executing })
    const result = proposal.operation === AccessOperation.SetAccessLevel
      ? await runSetAccessLevel(ctx, {
          employeeId: proposal.employeeId,
          resourceId: proposal.resourceId,
          targetLevel: proposal.targetLevel!,
          proposalId: proposal._id,
          ...identity
        })
      : await runRevokeAccess(ctx, {
          employeeId: proposal.employeeId,
          resourceId: proposal.resourceId,
          proposalId: proposal._id,
          ...identity
        })

    await ctx.db.patch(proposal._id, {
      status: ActionProposalStatus.Completed,
      decidedAt: now,
      result: result.status
    })
    await recordAudit(ctx, {
      action: 'proposal_executed',
      status: result.status === 'policy_denied' ? AuditStatus.Rejected : AuditStatus.Success,
      source: identity.source,
      actorId: identity.actorId,
      employeeId: proposal.employeeId,
      resourceId: proposal.resourceId,
      proposalId: proposal._id,
      metadata: { result },
      createdAt: now
    })

    return result
  }
})

export const cancel = internalMutation({
  args: { proposalId: v.id('actionProposals') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    const proposal = await ctx.db.get(args.proposalId)

    if (!proposal || proposal.status !== ActionProposalStatus.PendingConfirmation) {
      throw new ConvexError('Pending action proposal not found')
    }

    const now = Date.now()
    if (proposal.expiresAt <= now) {
      await expirePendingProposal(ctx, proposal, now)
      return { status: 'expired' } as const
    }

    await ctx.db.patch(proposal._id, {
      status: ActionProposalStatus.Cancelled,
      decidedAt: now,
      result: 'cancelled_by_admin'
    })
    await recordAudit(ctx, {
      action: 'proposal_cancelled',
      status: AuditStatus.Rejected,
      source: identity.source,
      actorId: identity.actorId,
      employeeId: proposal.employeeId,
      resourceId: proposal.resourceId,
      proposalId: proposal._id,
      metadata: { reason: 'cancelled_by_admin' },
      createdAt: now
    })
    return { status: 'cancelled' } as const
  }
})

export const expire = internalMutation({
  args: { proposalId: v.id('actionProposals') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId)

    if (!proposal || proposal.status !== ActionProposalStatus.PendingConfirmation || proposal.expiresAt > Date.now()) {
      return null
    }

    await expirePendingProposal(ctx, proposal, Date.now())
    return null
  }
})
