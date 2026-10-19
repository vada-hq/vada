import assert from 'node:assert/strict'
import { test } from 'node:test'
import { koreanDateOf, koreanOf } from './korean-time.js'

test('koreanDateOf: 서버 시간대와 상관없이 한국 날짜(YYYY-MM-DD)를 준다', () => {
  // 2026-01-01 00:00 KST는 2025-12-31 15:00 UTC다.
  assert.equal(koreanDateOf(new Date('2025-12-31T14:59:59Z')), '2025-12-31')
  assert.equal(koreanDateOf(new Date('2025-12-31T15:00:00Z')), '2026-01-01')
  assert.equal(koreanDateOf(new Date('2026-12-31T15:00:00Z')), '2027-01-01')
  assert.equal(
    koreanDateOf(new Date('2026-10-19T03:00:00Z')),
    koreanOf(new Date('2026-10-19T03:00:00Z')).slice(0, 10),
  )
})
