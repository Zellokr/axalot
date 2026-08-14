import { createGroq } from '@ai-sdk/groq'

// Convex's default (non-Node) action runtime still exposes `process.env`
// (its bundler inlines these at deploy time), but its isolate-only tsconfig
// doesn't ship Node's ambient types, so declare just what this file needs.
declare const process: { env: Record<string, string | undefined> }

const GROQ_MODEL_ID = 'openai/gpt-oss-20b'

// Groq's daily token quota is per organization, not per key, so rotation
// only helps when GROQ_API_KEYS holds keys from separate Groq accounts.
// A single GROQ_API_KEY still works unchanged when GROQ_API_KEYS isn't set.
function groqApiKeys(): string[] {
  const list = process.env.GROQ_API_KEYS
  const keys = (list ?? '').split(',').map(key => key.trim()).filter(Boolean)

  if (keys.length > 0) return keys

  const single = process.env.GROQ_API_KEY
  if (!single) throw new Error('Set GROQ_API_KEY or GROQ_API_KEYS')

  return [single]
}

function rotatingFetch(apiKeys: string[], onAllKeysRateLimited?: (retryAfterSeconds: number | undefined) => void): typeof fetch {
  return async (input, init) => {
    let lastResponse: Response | undefined

    for (const apiKey of apiKeys) {
      const headers = new Headers(init?.headers)
      headers.set('Authorization', `Bearer ${apiKey}`)
      const response = await fetch(input, { ...init, headers })

      if (response.status !== 429) return response

      lastResponse = response
    }

    if (lastResponse && onAllKeysRateLimited) {
      const retryAfter = Number(lastResponse.headers.get('retry-after'))
      onAllKeysRateLimited(Number.isFinite(retryAfter) ? retryAfter : undefined)
    }

    return lastResponse!
  }
}

/**
 * Builds the Groq chat model, rotating through GROQ_API_KEYS on a 429 before
 * giving up. `onAllKeysRateLimited` fires only once every key in the pool has
 * been tried and is still rate limited.
 */
export function createGroqModel(onAllKeysRateLimited?: (retryAfterSeconds: number | undefined) => void) {
  return createGroq({ fetch: rotatingFetch(groqApiKeys(), onAllKeysRateLimited) })(GROQ_MODEL_ID)
}
