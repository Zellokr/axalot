import type { UIMessage } from 'ai'

export interface AgentMessageRecord {
  _id: string
  order: number
  stepOrder: number
  status: string
  text?: string
  message?: { role?: string, content?: unknown }
}

export interface AgentActivityData {
  label: string
  detail: string
  loading: boolean
}

export type AgentChatMessage = UIMessage<unknown, { activity: AgentActivityData }>

const TOOL_LABELS: Record<string, string> = {
  findEmployee: 'Finding employee',
  findResource: 'Finding resource',
  getEmployeeAccess: 'Reviewing current access',
  searchPolicies: 'Consulting policy catalog',
  setAccessLevel: 'Applying access level',
  revokeAccess: 'Revoking access',
  createActionProposal: 'Preparing confirmation',
  executeActionProposal: 'Executing confirmed change',
  cancelActionProposal: 'Cancelling proposed change'
}

const OUTCOME_DETAILS: Record<string, string> = {
  applied: 'Access updated',
  unchanged: 'No change needed',
  policy_denied: 'Blocked by policy',
  approval_required: 'Approval requested',
  pending_confirmation: 'Awaiting confirmation',
  cancelled: 'Proposal cancelled',
  expired: 'Proposal expired',
  invalidated: 'Proposal no longer valid'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function contentParts(message: AgentMessageRecord): Record<string, unknown>[] {
  const content = message.message?.content
  return Array.isArray(content) ? content.filter(isRecord) : []
}

function messageText(message: AgentMessageRecord): string | undefined {
  if (message.text?.trim()) return message.text.trim()

  const content = message.message?.content
  if (typeof content === 'string' && content.trim()) return content.trim()

  const text = contentParts(message)
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => String(part.text).trim())
    .filter(Boolean)
    .join('\n')

  return text || undefined
}

function toolDetail(part: Record<string, unknown>, status: string): string {
  if (status === 'pending') return 'Working…'
  if (status === 'failed' || part.isError === true) return 'Action failed'

  const output = isRecord(part.output) ? part.output : undefined
  const value = output?.type === 'json' && isRecord(output.value)
    ? output.value
    : isRecord(part.result) ? part.result : undefined
  const outcome = typeof value?.status === 'string' ? value.status : undefined
  return (outcome && OUTCOME_DETAILS[outcome]) ?? 'Completed'
}

export function buildAgentConversation(messages: readonly AgentMessageRecord[]): AgentChatMessage[] {
  const items: AgentChatMessage[] = []
  const toolsByCall = new Map<string, AgentChatMessage>()
  const ordered = [...messages].sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder)

  for (const message of ordered) {
    const role = message.message?.role
    const text = messageText(message)
    if ((role === 'user' || role === 'assistant') && text) {
      items.push({
        id: `${message._id}-text`,
        role,
        parts: [{ type: 'text', text }]
      })
    }

    for (const part of contentParts(message)) {
      if ((part.type !== 'tool-call' && part.type !== 'tool-result') || typeof part.toolName !== 'string') continue

      const callId = typeof part.toolCallId === 'string' ? part.toolCallId : message._id
      const existing = toolsByCall.get(callId)
      if (existing) {
        const activity = existing.parts[0]
        if (activity?.type === 'data-activity') {
          activity.data.detail = toolDetail(part, message.status)
          activity.data.loading = message.status === 'pending'
        }
        continue
      }

      const activity: AgentChatMessage = {
        id: `${message._id}-tool`,
        role: 'assistant',
        parts: [{
          type: 'data-activity',
          data: {
            label: TOOL_LABELS[part.toolName] ?? 'Running secure operation',
            detail: toolDetail(part, message.status),
            loading: message.status === 'pending'
          }
        }]
      }
      toolsByCall.set(callId, activity)
      items.push(activity)
    }
  }

  return items
}

export function canSendAgentPrompt(prompt: string, pending: boolean): boolean {
  return prompt.trim().length > 0 && !pending
}
