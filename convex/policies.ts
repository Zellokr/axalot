import { google } from '@ai-sdk/google'
import { RAG } from '@convex-dev/rag'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { components, internal } from './_generated/api'
import { action, internalAction, internalQuery, query } from './_generated/server'
import { PolicyStatus } from './helpers/validators'
import { getActivePolicyDocuments } from './model/policies'

const POLICY_RAG_NAMESPACE = 'axalot-policies'

const googleEmbeddingModel = google.embedding('gemini-embedding-001')

export const policyRag = new RAG(components.rag, {
  textEmbeddingModel: googleEmbeddingModel,
  embeddingDimension: 3072
})

export const list = query({
  args: {},
  returns: v.any(),
  handler: async ctx => await ctx.db
    .query('policies')
    .withIndex('by_status', q => q.eq('status', PolicyStatus.Active))
    .collect()
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
