import assert from 'node:assert/strict'
import test from 'node:test'

import { formatDateTime } from '../../app/utils/format.ts'

test('formatDateTime matches the audit log date and time format', () => {
  const localTimestamp = new Date(2025, 0, 2, 15, 4).getTime()

  assert.equal(formatDateTime(localTimestamp), 'Jan 2, 2025, 3:04 PM')
})
