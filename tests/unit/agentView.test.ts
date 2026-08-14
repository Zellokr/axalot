import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildInitialMessages,
  canSendAgentPrompt,
  TOOL_INCOMPLETE_ERROR_KEY,
  TOOL_LABEL_KEYS,
  toolStateLabelKey
} from '../../app/utils/agentMessages.ts'

test('buildInitialMessages groups one turn into a single assistant message with ordered dynamic-tool and text parts', () => {
  const record = (id: string, order: number, role: string, content: unknown, stepOrder: number) => ({
    _id: id,
    order,
    stepOrder,
    status: 'success',
    message: { role, content }
  })
  const records = [
    record('user-message', 1, 'user', 'Give Laura admin access to Production.', 0),
    record('tool-call', 1, 'assistant', [{
      type: 'tool-call',
      toolCallId: 'opaque-call-id',
      toolName: 'setAccessLevel',
      input: { employeeId: 'opaque-employee-id', resourceId: 'opaque-resource-id', targetLevel: 'admin' }
    }], 1),
    record('tool-result', 1, 'tool', [{
      type: 'tool-result',
      toolCallId: 'opaque-call-id',
      toolName: 'setAccessLevel',
      output: { type: 'json', value: { status: 'approval_required', approvalId: 'opaque-approval-id' } }
    }], 2),
    record('assistant-message', 1, 'assistant', 'An approval was created. No access changed.', 3)
  ]

  const messages = buildInitialMessages(records)

  assert.deepEqual(messages.map(message => message.role), ['user', 'assistant'])
  assert.deepEqual(messages[0]?.parts, [{ type: 'text', text: 'Give Laura admin access to Production.' }])
  assert.deepEqual(messages[1]?.parts, [
    {
      type: 'dynamic-tool',
      toolName: 'setAccessLevel',
      toolCallId: 'opaque-call-id',
      state: 'output-available',
      input: { employeeId: 'opaque-employee-id', resourceId: 'opaque-resource-id', targetLevel: 'admin' },
      output: { status: 'approval_required', approvalId: 'opaque-approval-id' }
    },
    { type: 'text', text: 'An approval was created. No access changed.' }
  ])
})

test('buildInitialMessages marks a tool call with no matching result as output-error', () => {
  const records = [{
    _id: 'tool-call',
    order: 1,
    stepOrder: 0,
    status: 'failed',
    error: 'Groq API key is missing.',
    message: {
      role: 'assistant',
      content: [{
        type: 'tool-call',
        toolCallId: 'call-id',
        toolName: 'findEmployee',
        input: { query: 'María' }
      }]
    }
  }]

  const messages = buildInitialMessages(records)

  assert.deepEqual(messages[0]?.parts, [{
    type: 'dynamic-tool',
    toolName: 'findEmployee',
    toolCallId: 'call-id',
    state: 'output-error',
    input: { query: 'María' },
    errorText: 'Groq API key is missing.'
  }])
})

test('buildInitialMessages keeps a stable localized fallback when an incomplete tool has no backend error', () => {
  const records = [{
    _id: 'tool-call',
    order: 1,
    stepOrder: 0,
    status: 'failed',
    message: {
      role: 'assistant',
      content: [{
        type: 'tool-call',
        toolCallId: 'call-id',
        toolName: 'findEmployee',
        input: { query: 'María' }
      }]
    }
  }]

  const messages = buildInitialMessages(records)
  const part = messages[0]?.parts[0]

  assert.equal(TOOL_INCOMPLETE_ERROR_KEY, 'agent.errors.toolIncomplete')
  assert.equal(part?.type, 'dynamic-tool')
  assert.equal('errorText' in (part ?? {}) ? part.errorText : undefined, TOOL_INCOMPLETE_ERROR_KEY)
})

test('Agent tool helpers expose stable translation keys instead of English copy', () => {
  assert.equal(TOOL_LABEL_KEYS.findEmployee, 'agent.tools.findEmployee')
  assert.equal(TOOL_LABEL_KEYS.setAccessLevel, 'agent.tools.setAccessLevel')
  assert.equal(toolStateLabelKey('input-streaming'), 'agent.toolStates.working')
  assert.equal(toolStateLabelKey('input-available'), 'agent.toolStates.working')
  assert.equal(toolStateLabelKey('output-error'), 'agent.toolStates.failed')
  assert.equal(toolStateLabelKey('output-denied'), 'agent.toolStates.denied')
  assert.equal(toolStateLabelKey('approval-requested'), 'agent.toolStates.awaitingApproval')
  assert.equal(toolStateLabelKey('output-available'), 'agent.toolStates.completed')
})

test('canSendAgentPrompt rejects blank prompts and duplicate sends', () => {
  assert.equal(canSendAgentPrompt('  ', false), false)
  assert.equal(canSendAgentPrompt('Inspect María access', true), false)
  assert.equal(canSendAgentPrompt('Inspect María access', false), true)
})

test('Agent renders assistant Markdown while keeping user messages literal', async () => {
  const page = await readFile(new URL('../../app/pages/agent/index.vue', import.meta.url), 'utf8')
  const messages = page.match(/<UChatMessages[\s\S]*?<\/UChatMessages>/)?.[0] ?? ''

  assert.match(messages, /<Markdown[\s\S]*message\.role === 'assistant'[\s\S]*:value="part\.text"/)
  assert.doesNotMatch(messages, /<Comark|:markdown=/)
  assert.match(messages, /<p[\s\S]*message\.role === 'user'[\s\S]*whitespace-pre-wrap[\s\S]*{{ part\.text }}[\s\S]*<\/p>/)
})

test('Agent page delegates chat presentation to the Nuxt UI Chat family', async () => {
  const page = await readFile(new URL('../../app/pages/agent/index.vue', import.meta.url), 'utf8')

  for (const component of ['UChatMessages', 'UChatTool', 'UChatPrompt', 'UChatPromptSubmit', 'UChatShimmer']) {
    assert.match(page, new RegExp(`<${component}`))
  }
  assert.doesNotMatch(page, /<ol|<article|<UTextarea|<UChatReasoning/)
})

test('Agent page streams live turns over the Convex HTTP action instead of the retired action-based sendMessage', async () => {
  const page = await readFile(new URL('../../app/pages/agent/index.vue', import.meta.url), 'utf8')

  assert.match(page, /api\.axalotAgent\.listMessages/)
  assert.match(page, /useChat/)
  assert.match(page, /DefaultChatTransport/)
  assert.match(page, /agent-chat/)
  assert.doesNotMatch(page, /api\.axalotAgent\.sendMessage/)
  assert.match(page, /t\('agent\.trustCue'\)/)
  assert.match(page, /t\('agent\.examples\.inspectAccess'\)/)
  assert.match(page, /messages\.length === 0/)
  assert.match(page, /:disabled="!canSubmit"/)
  assert.doesNotMatch(page, /threadId\s*:/)
  assert.doesNotMatch(page, /source\s*:/)
})

test('Convex http.ts streams the agent turn through the Agent component, not a plain generateText call', async () => {
  const http = await readFile(new URL('../../convex/http.ts', import.meta.url), 'utf8')

  assert.match(http, /streamText/)
  assert.match(http, /saveStreamDeltas:\s*true/)
  assert.match(http, /toUIMessageStreamResponse/)
  assert.match(http, /agent-chat/)
  assert.match(http, /Access-Control-Allow-Origin/)
})
