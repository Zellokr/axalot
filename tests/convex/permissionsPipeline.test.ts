import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import schema from '../../convex/schema'
import {
  AccessLevel,
  AccessOperation,
  Department,
  EmployeeStatus,
  Level,
  ResourceType,
  Role
} from '../../convex/helpers/validators'
import { seedPolicyCatalog } from '../../convex/model/policies'
import type { Id } from '../../convex/_generated/dataModel'

const modules = import.meta.glob('../../convex/**/*.ts')

const setAccessLevel = makeFunctionReference<
  'mutation',
  { employeeId: Id<'employees'>, resourceId: Id<'resources'>, targetLevel: AccessLevel },
  { status: string, approvalId?: Id<'approvals'> }
>('permissions:setAccessLevel')

const setAccessLevelFromAgent = makeFunctionReference<
  'mutation',
  { employeeId: Id<'employees'>, resourceId: Id<'resources'>, targetLevel: AccessLevel },
  { status: string, approvalId?: Id<'approvals'> }
>('permissions:setAccessLevelFromAgent')

const createActionProposal = makeFunctionReference<
  'mutation',
  { operation: AccessOperation, employeeId: Id<'employees'>, resourceId: Id<'resources'>, targetLevel?: AccessLevel },
  { status: string, proposalId: Id<'actionProposals'> }
>('actionProposals:create')

const executeActionProposal = makeFunctionReference<
  'mutation',
  { proposalId: Id<'actionProposals'> },
  { status: string, reason?: string }
>('actionProposals:execute')

const approveAccess = makeFunctionReference<
  'mutation',
  { approvalId: Id<'approvals'> },
  { status: string }
>('approvals:approve')

async function setup(options?: { sensitive?: boolean, role?: Role, level?: Level }) {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const employeeId = await ctx.db.insert('employees', {
      name: 'Test Employee',
      email: 'test@axalot.dev',
      role: options?.role ?? Role.Developer,
      level: options?.level ?? Level.Senior,
      department: Department.Engineering,
      status: EmployeeStatus.Active
    })
    const resourceId = await ctx.db.insert('resources', {
      name: options?.sensitive ? 'Production' : 'GitHub',
      slug: options?.sensitive ? 'production' : 'github',
      type: options?.sensitive ? ResourceType.Environment : ResourceType.Application,
      sensitive: options?.sensitive ?? false
    })
    await seedPolicyCatalog(ctx)
    return { employeeId, resourceId }
  })

  return { t, ...ids }
}

describe('unified access pipeline', () => {
  it('applies an allowed low-risk grant and audits the semantic transition', async () => {
    const { t, employeeId, resourceId } = await setup()

    const result = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Write
    })

    expect(result).toMatchObject({ status: 'applied', changeType: 'grant' })
    const state = await t.run(async ctx => ({
      permissions: await ctx.db.query('permissions').collect(),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.permissions).toHaveLength(1)
    expect(state.permissions[0]?.accessLevel).toBe(AccessLevel.Write)
    expect(state.audit.at(-1)).toMatchObject({
      action: 'access_granted',
      source: 'admin',
      actorId: 'demo-admin'
    })
  })

  it('short-circuits unchanged before policy and performs no permission write', async () => {
    const { t, employeeId, resourceId } = await setup()
    await t.mutation(setAccessLevel, { employeeId, resourceId, targetLevel: AccessLevel.Write })
    const before = await t.run(async ctx => (await ctx.db.query('permissions').unique())!)

    const result = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Write
    })

    const after = await t.run(async ctx => ({
      permission: (await ctx.db.query('permissions').unique())!,
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(result).toMatchObject({ status: 'unchanged', changeType: 'unchanged' })
    expect(after.permission.grantedAt).toBe(before.grantedAt)
    expect(after.audit.at(-1)?.action).toBe('access_unchanged')
  })

  it('default-denies an uncovered transition without creating an approval', async () => {
    const { t, employeeId, resourceId } = await setup()

    const result = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Admin
    })

    expect(result).toMatchObject({
      status: 'policy_denied',
      policy: { decision: 'deny', code: 'no_applicable_policy' }
    })
    const state = await t.run(async ctx => ({
      permissions: await ctx.db.query('permissions').collect(),
      approvals: await ctx.db.query('approvals').collect(),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.permissions).toHaveLength(0)
    expect(state.approvals).toHaveLength(0)
    expect(state.audit.at(-1)?.action).toBe('access_policy_denied')
  })

  it('creates an approval instead of applying an allowed sensitive grant', async () => {
    const { t, employeeId, resourceId } = await setup({
      sensitive: true,
      role: Role.Devops,
      level: Level.Lead
    })

    const result = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Admin
    })

    expect(result).toMatchObject({ status: 'approval_required', changeType: 'grant' })
    const state = await t.run(async ctx => ({
      permissions: await ctx.db.query('permissions').collect(),
      approvals: await ctx.db.query('approvals').collect(),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.permissions).toHaveLength(0)
    expect(state.approvals).toHaveLength(1)
    expect(state.approvals[0]).toMatchObject({
      requestedBy: 'demo-admin',
      requestedSource: 'admin',
      status: 'pending'
    })
    expect(state.audit.at(-1)?.action).toBe('approval_created')
  })

  it('reuses the same valid pending approval across admin and Agent channels', async () => {
    const { t, employeeId, resourceId } = await setup({
      sensitive: true,
      role: Role.Devops,
      level: Level.Lead
    })
    const first = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Admin
    })
    const second = await t.mutation(setAccessLevelFromAgent, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Admin
    })

    expect(second.approvalId).toBe(first.approvalId)
    const state = await t.run(async ctx => ({
      approvals: await ctx.db.query('approvals').collect(),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.approvals).toHaveLength(1)
    expect(state.approvals[0]).toMatchObject({
      requestedSource: 'admin',
      requestedBy: 'demo-admin'
    })
    expect(state.audit.at(-1)).toMatchObject({
      action: 'approval_reused',
      source: 'agent'
    })
  })

  it('marks an approval stale when the frozen source level changed', async () => {
    const { t, employeeId, resourceId } = await setup({
      sensitive: true,
      role: Role.Devops,
      level: Level.Lead
    })
    const request = await t.mutation(setAccessLevel, {
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Admin
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('permissions', {
        employeeId,
        resourceId,
        accessLevel: AccessLevel.Read,
        grantedAt: Date.now()
      })
    })

    const result = await t.mutation(approveAccess, {
      approvalId: request.approvalId!
    })

    expect(result).toEqual({ status: 'stale' })
    const state = await t.run(async ctx => ({
      approval: await ctx.db.get(request.approvalId!),
      permissions: await ctx.db.query('permissions').collect(),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.approval?.status).toBe('stale')
    expect(state.permissions[0]?.accessLevel).toBe(AccessLevel.Read)
    expect(state.audit.at(-1)?.action).toBe('approval_stale')
  })

  it('invalidates an immutable proposal when its expected access state changes', async () => {
    const { t, employeeId, resourceId } = await setup()
    await t.run(async (ctx) => {
      await ctx.db.insert('agentConversations', {
        ownerId: 'demo-admin',
        threadId: 'test-thread',
        createdAt: Date.now()
      })
    })
    const proposal = await t.mutation(createActionProposal, {
      operation: AccessOperation.SetAccessLevel,
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Write
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('permissions', {
        employeeId,
        resourceId,
        accessLevel: AccessLevel.Read,
        grantedAt: Date.now()
      })
    })

    const result = await t.mutation(executeActionProposal, {
      proposalId: proposal.proposalId
    })

    expect(result).toEqual({ status: 'invalidated', reason: 'stale_proposal' })
    const state = await t.run(async ctx => ({
      proposal: await ctx.db.get(proposal.proposalId),
      audit: await ctx.db.query('auditLogs').collect()
    }))
    expect(state.proposal?.status).toBe('invalidated')
    expect(state.audit.at(-1)?.action).toBe('proposal_stale')
  })

  it('keeps only one pending proposal by cancelling the previous one', async () => {
    const { t, employeeId, resourceId } = await setup()
    await t.run(async (ctx) => {
      await ctx.db.insert('agentConversations', {
        ownerId: 'demo-admin',
        threadId: 'test-thread',
        createdAt: Date.now()
      })
    })
    const first = await t.mutation(createActionProposal, {
      operation: AccessOperation.SetAccessLevel,
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Read
    })
    const second = await t.mutation(createActionProposal, {
      operation: AccessOperation.SetAccessLevel,
      employeeId,
      resourceId,
      targetLevel: AccessLevel.Write
    })

    const proposals = await t.run(async ctx => await ctx.db.query('actionProposals').collect())
    expect(proposals).toHaveLength(2)
    expect(proposals.find(item => item._id === first.proposalId)?.status).toBe('cancelled')
    expect(proposals.find(item => item._id === second.proposalId)?.status).toBe('pending_confirmation')
  })
})
