import { expect, test } from 'vitest'
import type { IncomeAction, IncomeHistoryEntry } from '@vada/contracts'
import { defaultReceivedOn, incomeHistoryText, incomeMessage } from './income-view'

const period = { startsOn: '2026-09-01', endsOn: '2027-02-28' }
const entry = (action: IncomeAction, changes: Record<string, unknown> = {}): IncomeHistoryEntry =>
  ({ id: 'h', action, actor: { id: 'f', name: '재정' }, changes, createdAt: '2026-10-10T03:00:00.000Z' })

test('받은 날 기본값: 오늘이 기간 안이면 오늘, 기간 앞이면 시작일, 기간 뒤면 끝일이다', () => {
  expect(defaultReceivedOn(period, '2026-10-10')).toBe('2026-10-10')
  expect(defaultReceivedOn(period, '2026-08-31')).toBe('2026-09-01')
  expect(defaultReceivedOn(period, '2027-03-01')).toBe('2027-02-28')
})

test('처리 기록: 기록·수정(바뀐 칸을 이전 → 이후로)·취소(사유)를 적는다', () => {
  expect(incomeHistoryText(entry('created'))).toBe('기록')
  expect(incomeHistoryText(entry('updated', { amount: { from: 750000, to: 200000 }, budgetLine: { from: '학생회비', to: null },
    note: { from: null, to: '1차' } }))).toBe('수정: 금액 750,000원 → 200,000원 · 수입 항목 학생회비 → 없음 · 메모 없음 → 1차')
  expect(incomeHistoryText(entry('voided', { reason: '중복 입금' }))).toBe('취소: 중복 입금')
})

test('오류 코드는 화면 문구로 바꾸고, 모르는 코드는 기본 문구다', () => {
  expect(incomeMessage('DATE_OUTSIDE_PERIOD')).toBe('받은 날이 이 회계 기간 밖이에요.')
  expect(incomeMessage('BUDGET_LINE_INVALID')).toBe('수입 항목을 다시 골라 주세요.')
  expect(incomeMessage('INVALID_STATE')).toBe('취소된 수입은 바꿀 수 없어요.')
  expect(incomeMessage(undefined)).toBe('처리하지 못했어요. 다시 시도해 주세요.')
  expect(incomeMessage('PERIOD_CLOSED')).toBe('마감한 기간이라 수입을 바꿀 수 없어요.')
  expect(incomeMessage('CARRYOVER_INCOME')).toBe('앞 기간에서 넘어온 이월금은 바꿀 수 없어요.')
})
