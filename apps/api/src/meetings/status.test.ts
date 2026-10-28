import assert from 'node:assert/strict'
import { test } from 'node:test'
import { statusOf } from './status.js'

test('회의 상태는 취소·확정 우선이며 시작은 포함하고 끝은 포함하지 않는다', () => {
  const meeting = {
    heldAt: new Date('2026-10-28T15:00:00Z'),
    endsAt: new Date('2026-10-28T16:00:00Z'),
    confirmedAt: null,
    cancelledAt: null,
  }
  for (const [instant, status] of [
    ['2026-10-28T14:59:59Z', 'scheduled'],
    ['2026-10-28T15:00:00Z', 'in_progress'],
    ['2026-10-28T15:59:59Z', 'in_progress'],
    ['2026-10-28T16:00:00Z', 'wrapping_up'],
  ] as const)
    assert.equal(statusOf(meeting, new Date(instant)), status)
  assert.equal(statusOf({ ...meeting, confirmedAt: meeting.heldAt }, meeting.heldAt), 'done')
  assert.equal(
    statusOf(
      { ...meeting, confirmedAt: meeting.heldAt, cancelledAt: meeting.heldAt },
      meeting.heldAt,
    ),
    'cancelled',
  )
  assert.equal(statusOf({ ...meeting, endsAt: null }, meeting.endsAt), 'in_progress')
})
