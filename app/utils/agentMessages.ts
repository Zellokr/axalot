import type { UIMessage } from 'ai'

export interface AgentMessageRecord {
  _id: string
  order: number
  stepOrder: number
  status: string
  text?: string
  error?: string
  message?: { role?: string, content?: unknown }
}

export const TOOL_LABELS: Record<string, string> = {
  findEmployee: 'Finding employee',
  listEmployees: 'Listing employees',
  findResource: 'Finding resource',
  getEmployeeAccess: 'Reviewing current access',
  searchPolicies: 'Consulting policy catalog',
  listPolicies: 'Reviewing policy catalog',
  setPolicyStatus: 'Updating policy status',
  setAccessLevel: 'Applying access level',
  revokeAccess: 'Revoking access',
  createActionProposal: 'Preparing confirmation',
  executeActionProposal: 'Executing confirmed change',
  cancelActionProposal: 'Cancelling proposed change'
}

export function toolStateLabel(state: string): string {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return 'Working…'
    case 'output-error':
      return 'Action failed'
    case 'output-denied':
      return 'Denied'
    case 'approval-requested':
      return 'Awaiting approval'
    default:
      return 'Completed'
  }
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

/**
 * Converts persisted Convex agent messages into UIMessage history so useChat
 * can hydrate a thread it never generated itself. Groups every record sharing
 * the same `order` (one agent turn) into a single assistant UIMessage with
 * ordered dynamic-tool + text parts, matching the shape useChat produces live.
 */
export function buildInitialMessages(records: readonly AgentMessageRecord[]): UIMessage[] {
  const ordered = [...records].sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder)
  const turns = new Map<number, AgentMessageRecord[]>()

  for (const record of ordered) {
    const bucket = turns.get(record.order) ?? []
    bucket.push(record)
    turns.set(record.order, bucket)
  }

  const messages: UIMessage[] = []

  for (const [order, stepRecords] of [...turns.entries()].sort((a, b) => a[0] - b[0])) {
    const userRecord = stepRecords.find(record => record.message?.role === 'user')
    const assistantRecords = stepRecords.filter(record => record.message?.role !== 'user')

    if (userRecord) {
      const text = messageText(userRecord)
      if (text) {
        messages.push({ id: userRecord._id, role: 'user', parts: [{ type: 'text', text }] })
      }
    }

    if (assistantRecords.length === 0) continue

    const toolResultByCallId = new Map<string, Record<string, unknown>>()
    for (const record of assistantRecords) {
      for (const part of contentParts(record)) {
        if (part.type === 'tool-result' && typeof part.toolCallId === 'string') {
          toolResultByCallId.set(part.toolCallId, part)
        }
      }
    }

    const parts: UIMessage['parts'] = []
    let finalText: string | undefined

    for (const record of assistantRecords) {
      for (const part of contentParts(record)) {
        if (part.type !== 'tool-call' || typeof part.toolCallId !== 'string' || typeof part.toolName !== 'string') continue

        const result = toolResultByCallId.get(part.toolCallId)
        const rawOutput = result?.output
        const output = isRecord(rawOutput) && rawOutput.type === 'json' ? rawOutput.value : rawOutput

        parts.push((result === undefined
          ? {
              type: 'dynamic-tool',
              toolName: part.toolName,
              toolCallId: part.toolCallId,
              state: 'output-error',
              input: part.input ?? part.args,
              errorText: record.error ?? 'Tool call did not complete'
            }
          : {
              type: 'dynamic-tool',
              toolName: part.toolName,
              toolCallId: part.toolCallId,
              state: 'output-available',
              input: part.input ?? part.args,
              output
            }) as UIMessage['parts'][number])
      }

      if (record.message?.role === 'assistant') {
        const text = messageText(record)
        if (text) finalText = text
      }
    }

    if (finalText) {
      parts.push({ type: 'text', text: finalText })
    }

    if (parts.length) {
      messages.push({ id: `turn-${order}`, role: 'assistant', parts })
    }
  }

  return messages
}

export function canSendAgentPrompt(prompt: string, pending: boolean): boolean {
  return prompt.trim().length > 0 && !pending
}
