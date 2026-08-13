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

  assert.deepEqual(conversation.map(item => item.kind), ['message', 'tool', 'message'])
  assert.equal(conversation[0]?.text, 'Give Laura admin access to Production.')
  assert.equal(conversation[1]?.label, 'Applying access level')
  assert.equal(conversation[1]?.detail, 'Approval requested')
  assert.equal(conversation[2]?.text, 'An approval was created. No access changed.')
  assert.doesNotMatch(JSON.stringify(conversation), /opaque-/)
})

test('canSendAgentPrompt rejects blank prompts and duplicate sends', () => {
  assert.equal(canSendAgentPrompt('  ', false), false)
  assert.equal(canSendAgentPrompt('Inspect María access', true), false)
  assert.equal(canSendAgentPrompt('Inspect María access', false), true)
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
