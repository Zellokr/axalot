import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildAgentConversation,
  canSendAgentPrompt
} from '../../app/utils/agentMessages.ts'

test('buildAgentConversation renders messages and friendly tool outcomes in chronological order', () => {
  const record = (id: string, order: number, role: string, content: unknown, stepOrder = 0) => ({
    _id: id,
    _creationTime: order,
    order,
    stepOrder,
    status: 'success',
    tool: role === 'tool',
    message: { role, content }
  })
  const messages = [
    record('assistant-message', 3, 'assistant', 'An approval was created. No access changed.'),
    record('tool-result', 2, 'tool', [{
      type: 'tool-result', toolCallId: 'opaque-call-id', toolName: 'setAccessLevel',
      output: { type: 'json', value: { status: 'approval_required', approvalId: 'opaque-approval-id' } }
    }], 1),
    record('tool-call', 2, 'assistant', [{
      type: 'tool-call', toolCallId: 'opaque-call-id', toolName: 'setAccessLevel',
      input: { employeeId: 'opaque-employee-id', resourceId: 'opaque-resource-id', targetLevel: 'admin' }
    }]),
    record('user-message', 1, 'user', 'Give Laura admin access to Production.')
  ]

  const conversation = buildAgentConversation(messages)

  assert.deepEqual(conversation.map(message => message.role), ['user', 'assistant', 'assistant'])
  assert.deepEqual(conversation.map(message => message.parts), [
    [{ type: 'text', text: 'Give Laura admin access to Production.' }],
    [{
      type: 'data-activity',
      data: { label: 'Applying access level', detail: 'Approval requested', loading: false }
    }],
    [{ type: 'text', text: 'An approval was created. No access changed.' }]
  ])
  assert.doesNotMatch(JSON.stringify(conversation), /opaque-/)
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

test('Agent page uses only the server-owned conversation contract', async () => {
  const page = await readFile(new URL('../../app/pages/agent/index.vue', import.meta.url), 'utf8')

  assert.match(page, /api\.axalotAgent\.listMessages/)
  assert.match(page, /api\.axalotAgent\.sendMessage/)
  assert.match(page, /Policy Engine authorizes/)
  assert.match(page, /What access does María have to GitHub\?/)
  assert.match(page, /conversation\.length === 0/)
  assert.match(page, /:disabled="!canSubmit"/)
  assert.doesNotMatch(page, /threadId\s*:/)
  assert.doesNotMatch(page, /source\s*:/)
})
