import assert from 'node:assert/strict'
import { test } from 'node:test'
import { periodIsCurrent } from './current-cohort.js'

const period = { startsOn: '2026-01-01', endsOn: '2026-12-31' }

test('periodIsCurrent: 시작일과 끝일을 포함해 오늘(한국 날짜)을 담을 때만 지금 기간이다', () => {
  // 2026-01-01 00:00 KST는 2025-12-31 15:00 UTC다.
  assert.equal(periodIsCurrent(period, new Date('2025-12-31T14:59:59Z')), false)
  assert.equal(periodIsCurrent(period, new Date('2025-12-31T15:00:00Z')), true)
  assert.equal(periodIsCurrent(period, new Date('2026-06-15T03:00:00Z')), true)
  assert.equal(periodIsCurrent(period, new Date('2026-12-31T14:59:59Z')), true)
  assert.equal(periodIsCurrent(period, new Date('2026-12-31T15:00:00Z')), false)
  // 하루짜리 기간
  const oneDay = { startsOn: '2026-03-01', endsOn: '2026-03-01' }
  assert.equal(periodIsCurrent(oneDay, new Date('2026-03-01T03:00:00Z')), true)
  assert.equal(periodIsCurrent(oneDay, new Date('2026-03-02T03:00:00Z')), false)
})
