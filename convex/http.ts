import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { axalotAgent } from './axalotAgent'
import { DEMO_ADMIN_ID } from './domain/identity'
import { createGroqModel } from './domain/groqModel'

const http = httpRouter()

function corsHeaders(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}

function lastUserMessageText(messages: unknown): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('No message provided')
  }

  const last = messages[messages.length - 1] as { parts?: Array<{ type: string, text?: string }> }
  const text = (last.parts ?? [])
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Message has no text content')
  }

  return text
}

type AgentErrorPayload = { code: 'rate_limit', retryMinutes: number } | { code: 'unknown' }

http.route({
  path: '/agent-chat',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => new Response(null, { headers: corsHeaders(request) }))
})

http.route({
  path: '/agent-chat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let retryAfterSeconds: number | undefined
    const model = createGroqModel((seconds) => {
      retryAfterSeconds = seconds
    })

    try {
      const body = await request.json()
      const prompt = lastUserMessageText(body.messages)

      const conversation = await ctx.runMutation(internal.axalotAgent.ensureDemoConversation, {})
      const { thread } = await axalotAgent.continueThread(ctx, {
        threadId: conversation.threadId,
        userId: DEMO_ADMIN_ID
      })
      const result = await thread.streamText({ prompt, model }, { saveStreamDeltas: true })

      return result.toUIMessageStreamResponse({ headers: corsHeaders(request) })
    } catch {
      const payload: AgentErrorPayload = retryAfterSeconds
        ? { code: 'rate_limit', retryMinutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)) }
        : { code: 'unknown' }
      return new Response(JSON.stringify(payload), { status: 500, headers: corsHeaders(request) })
    }
  })
})

export default http
