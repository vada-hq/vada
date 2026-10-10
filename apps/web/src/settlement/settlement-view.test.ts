import { expect, test } from 'vitest'
import type { EventFinanceAction, EventFinanceHistoryEntry } from '@vada/contracts'
import { budgetInput, budgetText, defaultFeeIncomeLine, financeHistoryText, readyToSettle, remainingText, requirements, settledDay,
  settlementMessage } from './settlement-view'
import { eventFinance } from './settlement-fixtures'

test('예산·남은 예산: 미정은 미정과 —이고, 0보다 작으면 초과로 적는다', () => {
  expect([budgetText(null), budgetText(0), budgetText(3000000)]).toEqual(['미정', '0원', '3,000,000원'])
  expect([remainingText(null), remainingText(0), remainingText(-120000)]).toEqual(['—', '0원', '120,000원 초과'])
})

test('정산 조건 셋이 모두 0이어야 정산할 수 있고, 각 줄에 개수와 해결 방법이 있다', () => {
  const pending = eventFinance({ missingEvidence: 2, pendingRequests: 0, unrecordedItems: 1 })
  expect(requirements(pending).map(item => [item.label, item.done])).toEqual([['증빙 누락 2건', false], ['검토 대기 요청 0건', true],
    ['지출로 기록하지 않은 승인 품목 1개', false]])
  expect(requirements(pending).map(item => item.hint)).toEqual(['지출 상세에서 증빙을 올려 주세요.', '구매 검토에서 승인하거나 반려해 주세요.',
    '산 품목은 지출에 연결하고, 사지 않을 품목은 승인을 취소해 주세요.'])
  expect([readyToSettle(pending), readyToSettle(eventFinance())]).toEqual([false, true])
})

test('받은 참가비가 있으면 넣을 회계 기간이 있어야 정산할 수 있다', () => {
  const fees = { received: 14000, count: 2, unpaid: 1 }
  const period = { id: 'p1', name: '2999년 1학기', incomes: [] }
  // 받은 참가비가 없으면 조건을 더하지 않는다.
  expect(requirements(eventFinance({ fees: { received: 0, count: 0, unpaid: 1 } })).map(item => item.key))
    .toEqual(['missingEvidence', 'pendingRequests', 'unrecordedItems'])
  expect(requirements(eventFinance({ fees, period })).at(-1)).toEqual({ key: 'feePeriod', label: '참가비를 넣을 회계 기간: 2999년 1학기',
    hint: '예산 화면의 편성 수정에서 이 행사를 회계 기간에 넣어 주세요.', done: true })
  const missing = requirements(eventFinance({ fees })).at(-1)!
  expect([missing.label, missing.done]).toEqual(['참가비를 넣을 회계 기간이 없어요', false])
  expect([readyToSettle(eventFinance({ fees })), readyToSettle(eventFinance({ fees, period }))]).toEqual([false, true])
})

test('참가비 수입 항목의 기본값은 이름에 "참가비"가 든 첫 줄이고, 없으면 고르지 않는다', () => {
  expect(defaultFeeIncomeLine([{ id: 'l1', name: '학생회비' }, { id: 'l2', name: '행사 참가비' }, { id: 'l3', name: '참가비 2' }])).toBe('l2')
  expect(defaultFeeIncomeLine([{ id: 'l1', name: '학생회비' }])).toBe('')
})

test('처리 기록 문구와 정산한 날', () => {
  const entry = (action: EventFinanceAction, changes: Record<string, unknown> = {}, reason: string | null = null): EventFinanceHistoryEntry =>
    ({ id: 'h', action, actor: { id: 'f', name: '재정' }, changes, reason, createdAt: '2026-10-09T09:00:00.000Z' })
  expect(financeHistoryText(entry('budget_set', { from: null, to: 3000000 }))).toBe('예산 미정 → 3,000,000원')
  expect(financeHistoryText(entry('settled', { budget: 3000000, spent: 950000, expenseCount: 4 }))).toBe('정산 완료 · 실제 지출 950,000원')
  expect(financeHistoryText(entry('settled', { budget: null, spent: 0, expenseCount: 0, fee: null }))).toBe('정산 완료 · 실제 지출 0원')
  expect(financeHistoryText(entry('settled', { budget: null, spent: 0, expenseCount: 0,
    fee: { amount: 14000, count: 2, period: '2999년 1학기', line: null } }))).toBe('정산 완료 · 실제 지출 0원 · 참가비 14,000원 → 2999년 1학기 수입')
  expect(financeHistoryText(entry('reopened', {}, '영수증 빠짐'))).toBe('정산 다시 엶: 영수증 빠짐')
  // 한국 시간으로 날짜를 센다.
  expect(settledDay('2026-10-09T15:30:00.000Z')).toBe('10월 10일')
})

test('오류는 화면 문구로 바꾼다', () => {
  expect(settlementMessage('NOT_READY_TO_SETTLE')).toBe('아직 정산할 수 없어요. 남은 항목을 확인해 주세요.')
  expect(settlementMessage('EXPORT_TOO_LARGE')).toBe('지출이 너무 많아 엑셀로 만들 수 없어요.')
  expect(settlementMessage('PERIOD_CLOSED')).toBe('마감한 회계 기간의 행사라 정산을 다시 열 수 없어요.')
  expect(settlementMessage('BUDGET_LINE_INVALID')).toBe('참가비 수입 항목을 다시 골라 주세요.')
  expect(settlementMessage('???')).toBe('처리하지 못했어요. 다시 시도해 주세요.')
})

test('예산 칸의 글: 쉼표·공백·"원"은 지우고, 비우면 미정이며, 숫자가 아닌 글자가 남으면 저장할 수 없는 값이다', () => {
  expect([budgetInput('300,000'), budgetInput(' 3,000,000원 '), budgetInput('0')]).toEqual([300000, 3000000, 0])
  expect([budgetInput(''), budgetInput('  ')]).toEqual([null, null])
  for (const text of ['30만', '1e5', '-1', '3.5', '３００']) expect(Number.isNaN(budgetInput(text)), text).toBe(true)
})
