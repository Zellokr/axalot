import { google } from '@ai-sdk/google'
import { RAG } from '@convex-dev/rag'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { components, internal } from './_generated/api'
import { action, internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { resolveDemoActor } from './domain/identity'
import { AuditSource, policyRuleValidator, policyStatusValidator, policyValidator } from './helpers/validators'
import { getActivePolicyDocuments, listPoliciesWithRules, setPolicyStatus } from './model/policies'

const POLICY_RAG_NAMESPACE = 'axalot-policies'

const googleEmbeddingModel = google.embedding('gemini-embedding-001')

export const policyRag = new RAG(components.rag, {
  textEmbeddingModel: googleEmbeddingModel,
  embeddingDimension: 3072
})

export const list = query({
  args: {},
  returns: v.array(policyValidator.extend({ rules: v.array(policyRuleValidator) })),
  handler: async ctx => await listPoliciesWithRules(ctx)
})

export const setStatus = mutation({
  args: {
    policyId: v.id('policies'),
    status: policyStatusValidator
  },
  returns: policyValidator,
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Admin)
    return await setPolicyStatus(ctx, { policyId: args.policyId, status: args.status, ...identity })
  }
})

export const listForAgent = internalQuery({
  args: {},
  returns: v.array(policyValidator.extend({ rules: v.array(policyRuleValidator) })),
  handler: async ctx => await listPoliciesWithRules(ctx)
})

export const setStatusFromAgent = internalMutation({
  args: {
    policyId: v.id('policies'),
    status: policyStatusValidator
  },
  returns: policyValidator,
  handler: async (ctx, args) => {
    const identity = resolveDemoActor(AuditSource.Agent)
    return await setPolicyStatus(ctx, { policyId: args.policyId, status: args.status, ...identity })
  }
})

export const getActiveDocuments = internalQuery({
  args: {},
  returns: v.any(),
  handler: async ctx => await getActivePolicyDocuments(ctx)
})

export async function searchPolicyCatalog(
  ctx: Parameters<typeof policyRag.search>[0],
  queryText: string
) {
  const result = await policyRag.search(ctx, {
    namespace: POLICY_RAG_NAMESPACE,
    query: queryText,
    limit: 6,
    vectorScoreThreshold: 0.35
  })

  return {
    text: result.text,
    entries: result.entries.map(entry => ({
      entryId: entry.entryId,
      title: entry.title,
      metadata: entry.metadata
    }))
  }
}

export const search = action({
  args: { query: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => await searchPolicyCatalog(ctx, args.query)
})

export const syncRagCatalog = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<{ synchronized: number }> => {
    const documents: Doc<'policies'>[] = await ctx.runQuery(
      internal.policies.getActiveDocuments,
      {}
    )
    const results: Array<Awaited<ReturnType<typeof policyRag.add>>> = []

    for (const policy of documents) {
      const text = [policy.description, policy.content].join('\n\n')
      results.push(await policyRag.add(ctx, {
        namespace: POLICY_RAG_NAMESPACE,
        key: `${policy.key}@${policy.version}`,
        title: `${policy.title} (v${policy.version})`,
        text,
        metadata: {
          policyId: policy._id,
          key: policy.key,
          version: policy.version
        }
      }))
    }

    return { synchronized: results.length }
  }
})
