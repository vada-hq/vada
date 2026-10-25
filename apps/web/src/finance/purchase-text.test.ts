import { expect, test } from 'vitest'
import { decisionLine, versionLine } from './purchase-text'
import { wonLabel } from './purchase-view'

const by = { id: 'm2', name: '이재정' }
const at = '2026-10-21T05:03:00.000Z'

test('결재 줄은 이름, 한국 시각, 결과이고 반려는 사유가 붙는다', () => {
  const base = { id: 'd', lineItemId: 'i', by, at, reason: null }
  expect(decisionLine({ ...base, outcome: 'approved' })).toBe('이재정 · 10월 21일 14:03 · 승인')
  expect(decisionLine({ ...base, outcome: 'rejected', reason: '이미 있어요' })).toBe(
    '이재정 · 10월 21일 14:03 · 반려: 이미 있어요',
  )
  expect(decisionLine({ ...base, outcome: 'cancelled', reason: '사지 않아요' })).toBe(
    '이재정 · 10월 21일 14:03 · 취소: 사지 않아요',
  )
  expect(decisionLine({ ...base, outcome: 'approved', by: null })).toContain('알 수 없는 사람')
})

test('이력 줄은 요청함과 취소함이다', () => {
  expect(versionLine({ versionNo: 1, at, by, changes: [{ field: 'created' }] })).toBe(
    '이재정 · 10월 21일 14:03 · 요청함',
  )
  expect(versionLine({ versionNo: 2, at, by, changes: [{ field: 'cancelled' }] })).toBe(
    '이재정 · 10월 21일 14:03 · 취소함',
  )
})

test('금액은 천 단위로 끊는다', () => {
  expect(wonLabel(0)).toBe('0원')
  expect(wonLabel(999)).toBe('999원')
  expect(wonLabel(1_234_567)).toBe('1,234,567원')
})
