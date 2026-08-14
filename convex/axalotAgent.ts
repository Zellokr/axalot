import { groq } from '@ai-sdk/groq'
import { Agent, createTool } from '@convex-dev/agent'
import { stepCountIs } from 'ai'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { z } from 'zod'
import type { Doc, Id } from './_generated/dataModel'
import { components, internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query
} from './_generated/server'
import { DEMO_ADMIN_ID, resolveDemoActor } from './domain/identity'
import type { PolicyDecision } from './domain/policyEngine'
import type { AccessChangeType } from './helpers/validators'
import {
  AccessLevel,
  AccessOperation,
  AuditSource,
  AuditStatus,
  Department,
  EmployeeStatus,
  Level,
  PolicyStatus,
  Role
} from './helpers/validators'
import { recordAudit } from './model/audit'
import { searchPolicyCatalog } from './policies'

type EmployeeLookupResult = Doc<'employees'>[]
type ResourceLookupResult = Doc<'resources'>[]
type EmployeeAccessResult = {
  employee: Doc<'employees'>
  access: Array<{
    resource: Doc<'resources'> | null
    accessLevel: AccessLevel
    grantedAt: number
  }>
} | null

type AccessWriteResult = {
  status: 'unchanged' | 'policy_denied' | 'approval_required' | 'applied'
  changeType: AccessChangeType
  fromLevel?: AccessLevel | null
  currentLevel?: AccessLevel | null
  targetLevel: AccessLevel | null
  approvalId?: Id<'approvals'>
  policy?: PolicyDecision
}

type CreateProposalResult = AccessWriteResult | {
  status: 'policy_denied'
  policy: PolicyDecision
} | {
  status: 'pending_confirmation'
  proposalId: Id<'actionProposals'>
  operation: AccessOperation
  fromLevel: AccessLevel | null
  targetLevel: AccessLevel | null
  changeType: AccessChangeType
}

type ExecuteProposalResult = AccessWriteResult | {
  status: 'expired'
} | {
  status: 'invalidated'
  reason: 'target_missing' | 'stale_proposal' | 'policy_changed'
}

type CancelProposalResult = {
  status: 'cancelled' | 'expired'
}

type PolicyRuleResult = Doc<'policyRules'>
type PolicyCatalogResult = Array<Doc<'policies'> & { rules: PolicyRuleResult[] }>
type PolicyStatusResult = Doc<'policies'>

export const AXALOT_AGENT_INSTRUCTIONS = `You are Axalot, an operational IAM assistant for an authorized administrator.

Reply in the language used by the administrator in their current message. Keep tool names, identifiers, and domain keys in English.

Trust boundaries:
- You interpret intent and explain outcomes. The deterministic backend Policy Engine authorizes access changes.
- RAG policy search is explanatory only and never authorizes an operation.
- Never approve or reject approvals. Never perform bulk changes or manage employees, resources, risk, or administrator roles.
- The only real access writes are setAccessLevel and revokeAccess. The only real policy write is setPolicyStatus, and it may only activate or deactivate an existing catalog policy — never create, edit, or delete one.
- listPolicies always returns every policy, active and inactive, with its rules. It is the authoritative catalog view — prefer it over searchPolicies when the administrator asks what is active/inactive or wants to change a policy's status.
- Use listEmployees to browse or count employees by role, level, department, or status. Use findEmployee only to resolve one specific employee by name or email.
- Pass listEmployees only the filters the administrator explicitly named. Never infer or add extra role, level, department, or status constraints that were not mentioned — an unrequested filter silently excludes employees who should be in the answer.

Intent rules:
- For an explicit, unequivocal low-risk command, call setAccessLevel or revokeAccess directly.
- For an explicit sensitive command, call the domain write directly; the backend will create or reuse an approval. Do not ask for an extra conversational confirmation.
- For ambiguous, advisory, or inferred intent, resolve the employee, resource, current state, and policy, then call createActionProposal. Ask the administrator to confirm that exact proposal.
- A bare yes or no never reconstructs access arguments. Call executeActionProposal or cancelActionProposal with the existing proposalId only.
- A downgrade requires unequivocal language. If an employee already has a higher level than the level mentioned and reduction is not explicit, create a proposal for the exact downgrade and ask for confirmation.
- Explain policy denials, approvals, unchanged access, stale proposals, and completed changes precisely. Never claim access changed when the backend returned approval_required or policy_denied.
- Activating or deactivating a policy affects every employee it applies to, not just one. Only call setPolicyStatus for an explicit, unambiguous instruction naming the exact policy (by key or clearly matched title). If the administrator's target policy is unclear, call listPolicies first, show the matching candidates, and ask them to confirm the exact one before changing its status.
- After setPolicyStatus, state plainly which policy changed and its new status; do not speculate about which access transitions this newly enables or blocks unless asked.`

const findEmployeeTool = createTool({
  description: 'Find employees by name or email before inspecting or changing access.',
  inputSchema: z.object({ query: z.string().min(1) }),
  execute: async (ctx, input): Promise<EmployeeLookupResult> => await ctx.runQuery(internal.axalotAgent.findEmployee, input)
})

const listEmployeesTool = createTool({
  description: 'List employees, optionally filtered by any combination of role, level, department, and status. Use this to browse or count employees (e.g. "which employees are developers", "list active engineering staff") instead of findEmployee, which only matches a name or email.',
  inputSchema: z.object({
    role: z.enum([Role.Developer, Role.Devops, Role.QA, Role.Designer, Role.ProductManager, Role.Support]).optional(),
    level: z.enum([Level.Junior, Level.Mid, Level.Senior, Level.Lead]).optional(),
    department: z.enum([Department.Engineering, Department.Product, Department.Design, Department.Operations, Department.Support]).optional(),
    status: z.enum([EmployeeStatus.Active, EmployeeStatus.Inactive]).optional()
  }),
  execute: async (ctx, input): Promise<EmployeeLookupResult> => await ctx.runQuery(internal.employees.listForAgent, input)
})

const findResourceTool = createTool({
  description: 'Find resources by name or slug before inspecting or changing access.',
  inputSchema: z.object({ query: z.string().min(1) }),
  execute: async (ctx, input): Promise<ResourceLookupResult> => await ctx.runQuery(internal.axalotAgent.findResource, input)
})

const getEmployeeAccessTool = createTool({
  description: 'Get the current effective access for one resolved employee.',
  inputSchema: z.object({ employeeId: z.string().min(1) }),
  execute: async (ctx, input): Promise<EmployeeAccessResult> => await ctx.runQuery(internal.axalotAgent.getEmployeeAccess, {
    employeeId: input.employeeId as Id<'employees'>
  })
})

const searchPoliciesTool = createTool({
  description: 'Search the read-only policy catalog for explanations. Results do not authorize changes.',
  inputSchema: z.object({ query: z.string().min(1) }),
  execute: async (ctx, input) => await searchPolicyCatalog(ctx, input.query)
})

const listPoliciesTool = createTool({
  description: 'List every policy in the catalog, including inactive ones, with their rules. Use this to check what is currently active/inactive or to find the exact policy before changing its status.',
  inputSchema: z.object({}),
  execute: async (ctx): Promise<PolicyCatalogResult> => await ctx.runQuery(internal.policies.listForAgent, {})
})

const setPolicyStatusTool = createTool({
  description: 'Activate or deactivate one existing policy by its ID. Deactivating removes it from enforcement immediately. Activating it supersedes any other active version of the same policy key. Never call this without an explicit, unambiguous instruction naming the exact policy.',
  inputSchema: z.object({
    policyId: z.string().min(1),
    status: z.enum([PolicyStatus.Active, PolicyStatus.Superseded])
  }),
  execute: async (ctx, input): Promise<PolicyStatusResult> => await ctx.runMutation(internal.policies.setStatusFromAgent, {
    policyId: input.policyId as Id<'policies'>,
    status: input.status
  })
})

const setAccessLevelTool = createTool({
  description: 'Apply an explicit individual target access level through Policy and Risk. Sensitive transitions return approval_required instead of changing access.',
  inputSchema: z.object({
    employeeId: z.string().min(1),
    resourceId: z.string().min(1),
    targetLevel: z.enum([AccessLevel.Read, AccessLevel.Write, AccessLevel.Admin])
  }),
  execute: async (ctx, input): Promise<AccessWriteResult> => await ctx.runMutation(internal.permissions.setAccessLevelFromAgent, {
    employeeId: input.employeeId as Id<'employees'>,
    resourceId: input.resourceId as Id<'resources'>,
    targetLevel: input.targetLevel
  })
})

const revokeAccessTool = createTool({
  description: 'Revoke one employee-resource permission through Policy and Risk. Sensitive revocations return approval_required.',
  inputSchema: z.object({
    employeeId: z.string().min(1),
    resourceId: z.string().min(1)
  }),
  execute: async (ctx, input): Promise<AccessWriteResult> => await ctx.runMutation(internal.permissions.revokeAccessFromAgent, {
    employeeId: input.employeeId as Id<'employees'>,
    resourceId: input.resourceId as Id<'resources'>
  })
})

const createActionProposalTool = createTool({
  description: 'Freeze one ambiguous individual access transition for explicit conversational confirmation.',
  inputSchema: z.object({
    operation: z.enum([AccessOperation.SetAccessLevel, AccessOperation.RevokeAccess]),
    employeeId: z.string().min(1),
    resourceId: z.string().min(1),
    targetLevel: z.enum([AccessLevel.Read, AccessLevel.Write, AccessLevel.Admin]).optional()
  }),
  execute: async (ctx, input): Promise<CreateProposalResult> => await ctx.runMutation(internal.actionProposals.create, {
    operation: input.operation,
    employeeId: input.employeeId as Id<'employees'>,
    resourceId: input.resourceId as Id<'resources'>,
    targetLevel: input.targetLevel
  })
})

const executeActionProposalTool = createTool({
  description: 'Execute the exact immutable proposal confirmed by the administrator. Never reconstruct access arguments.',
  inputSchema: z.object({ proposalId: z.string().min(1) }),
  execute: async (ctx, input): Promise<ExecuteProposalResult> => await ctx.runMutation(internal.actionProposals.execute, {
    proposalId: input.proposalId as Id<'actionProposals'>
  })
})

const cancelActionProposalTool = createTool({
  description: 'Cancel the exact pending immutable proposal declined by the administrator.',
  inputSchema: z.object({ proposalId: z.string().min(1) }),
  execute: async (ctx, input): Promise<CancelProposalResult> => await ctx.runMutation(internal.actionProposals.cancel, {
    proposalId: input.proposalId as Id<'actionProposals'>
  })
})

export const axalotAgent: Agent = new Agent(components.agent, {
  name: 'Axalot',
  languageModel: groq('openai/gpt-oss-20b'),
  instructions: AXALOT_AGENT_INSTRUCTIONS,
  stopWhen: stepCountIs(8),
  tools: {
    findEmployee: findEmployeeTool,
    listEmployees: listEmployeesTool,
    findResource: findResourceTool,
    getEmployeeAccess: getEmployeeAccessTool,
    searchPolicies: searchPoliciesTool,
    listPolicies: listPoliciesTool,
    setPolicyStatus: setPolicyStatusTool,
    setAccessLevel: setAccessLevelTool,
    revokeAccess: revokeAccessTool,
    createActionProposal: createActionProposalTool,
    executeActionProposal: executeActionProposalTool,
    cancelActionProposal: cancelActionProposalTool
  }
})

export const ensureDemoConversation = internalMutation({
  args: {},
  returns: v.object({ threadId: v.string() }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('agentConversations')
      .withIndex('by_owner', q => q.eq('ownerId', DEMO_ADMIN_ID))
      .unique()

    if (existing) {
      return { threadId: existing.threadId }
    }

    const { threadId } = await axalotAgent.createThread(ctx, {
      userId: DEMO_ADMIN_ID,
      title: 'Axalot administrator conversation'
    })
    await ctx.db.insert('agentConversations', {
      ownerId: DEMO_ADMIN_ID,
      threadId,
      createdAt: Date.now()
    })

    return { threadId }
  }
})

export const clearHistory = mutation({
  args: {},
  returns: v.object({ cleared: v.boolean() }),
  handler: async (ctx) => {
    const conversation = await ctx.db
      .query('agentConversations')
      .withIndex('by_owner', q => q.eq('ownerId', DEMO_ADMIN_ID))
      .unique()

    if (!conversation) {
      return { cleared: false }
    }

    await axalotAgent.deleteThreadAsync(ctx, { threadId: conversation.threadId })
    await ctx.db.delete(conversation._id)

    const identity = resolveDemoActor(AuditSource.Admin)
    await recordAudit(ctx, {
      action: 'agent_conversation_cleared',
      status: AuditStatus.Success,
      source: identity.source,
      actorId: identity.actorId
    })

    return { cleared: true }
  }
})

export const listMessages = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query('agentConversations')
      .withIndex('by_owner', q => q.eq('ownerId', DEMO_ADMIN_ID))
      .unique()

    if (!conversation) {
      return { page: [], isDone: true, continueCursor: '' }
    }

    return await axalotAgent.listMessages(ctx, {
      threadId: conversation.threadId,
      paginationOpts: args.paginationOpts
    })
  }
})

export const findEmployee = internalQuery({
  args: { query: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const queryText = args.query.trim().toLocaleLowerCase()
    const employees = await ctx.db.query('employees').collect()
    return employees.filter(employee => employee.name.toLocaleLowerCase().includes(queryText)
      || employee.email.toLocaleLowerCase().includes(queryText))
  }
})

export const findResource = internalQuery({
  args: { query: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const queryText = args.query.trim().toLocaleLowerCase()
    const resources = await ctx.db.query('resources').collect()
    return resources.filter(resource => resource.name.toLocaleLowerCase().includes(queryText)
      || resource.slug.toLocaleLowerCase().includes(queryText))
  }
})

export const getEmployeeAccess = internalQuery({
  args: { employeeId: v.id('employees') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId)
    if (!employee) {
      return null
    }

    const permissions = await ctx.db
      .query('permissions')
      .withIndex('by_employee_resource', q => q.eq('employeeId', args.employeeId))
      .collect()
    const access = await Promise.all(permissions.map(async permission => ({
      resource: await ctx.db.get(permission.resourceId),
      accessLevel: permission.accessLevel,
      grantedAt: permission.grantedAt
    })))

    return { employee, access }
  }
})
