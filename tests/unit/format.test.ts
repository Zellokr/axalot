import assert from 'node:assert/strict'
import test from 'node:test'

import { formatDateTime } from '../../app/utils/format.ts'

test('formatDateTime matches the selected English and Spanish date and time formats', () => {
  const localTimestamp = new Date(2025, 0, 2, 15, 4).getTime()

  assert.equal(formatDateTime(localTimestamp, 'en-US'), 'Jan 2, 2025, 3:04 PM')
  assert.equal(formatDateTime(localTimestamp, 'es-ES'), '2 ene 2025, 15:04')
})
