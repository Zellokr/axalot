import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { axalotAgent } from './axalotAgent'
import { DEMO_ADMIN_ID } from './domain/identity'

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

http.route({
  path: '/agent-chat',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => new Response(null, { headers: corsHeaders(request) }))
})

http.route({
  path: '/agent-chat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json()
      const prompt = lastUserMessageText(body.messages)

      const conversation = await ctx.runMutation(internal.axalotAgent.ensureDemoConversation, {})
      const { thread } = await axalotAgent.continueThread(ctx, {
        threadId: conversation.threadId,
        userId: DEMO_ADMIN_ID
      })
      const result = await thread.streamText({ prompt }, { saveStreamDeltas: true })

      return result.toUIMessageStreamResponse({ headers: corsHeaders(request) })
    } catch (err) {
      return new Response((err as Error).message, { status: 500, headers: corsHeaders(request) })
    }
  })
})

export default http
