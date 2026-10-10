import { expect, test } from 'vitest'
import type { ExpenseAction } from '@vada/contracts'
import { comparisonText, dayText, eventText, expenseMessage, fitFileName, groupByMonth, historyText } from './expense-view'

test('결제일·달 묶음·승인 금액 비교 문구', () => {
  expect(dayText('2026-10-09')).toBe('10.9')
  expect(groupByMonth([{ paidOn: '2026-10-09' }, { paidOn: '2026-10-01' }, { paidOn: '2026-09-30' }]).map(group => [group.title, group.expenses.length]))
    .toEqual([['2026년 10월', 2], ['2026년 9월', 1]])
  expect(comparisonText({ approvedTotal: 135000, amount: 137500 })).toBe('승인 135,000원 → 실제 137,500원 · 2,500원 많음')
  expect(comparisonText({ approvedTotal: 25000, amount: 24500 })).toBe('승인 25,000원 → 실제 24,500원 · 500원 적음')
  expect(comparisonText({ approvedTotal: 5000, amount: 5000 })).toBe('승인 5,000원 → 실제 5,000원')
  expect(comparisonText({ approvedTotal: null, amount: 5000 })).toBeNull()
})

test('처리 기록 문구: 수정은 바뀐 칸을, 취소는 사유를, 증빙은 종류와 파일 이름을 적는다', () => {
  const entry = (action: ExpenseAction, changes: Record<string, unknown>) =>
    ({ id: 'h', action, actor: { id: 'f', name: '재정' }, changes, createdAt: '2026-10-09T00:00:00.000Z' })
  expect(historyText(entry('updated', { amount: { from: 46000, to: 47000 }, event: { from: '체육대회', to: null },
    method: { from: 'cash', to: 'transfer' }, items: { added: 1, removed: 2 } })))
    .toBe('수정: 금액 46,000원 → 47,000원 · 행사 체육대회 → 상시 운영 · 결제 수단 현금 → 계좌이체 · 연결 품목 1개 더함, 2개 뺌')
  expect(historyText(entry('voided', { reason: '중복', releasedItems: 1 }))).toBe('취소: 중복')
  expect(historyText(entry('receipt_added', { fileName: 'a.jpg', kind: 'statement' }))).toBe('증빙 추가: 거래명세서 a.jpg')
  expect(historyText(entry('created', {}))).toBe('기록')
})

test('긴 파일 이름은 확장자를 남기고 줄인다', () => {
  expect(fitFileName('  영수증.jpg  ', 200)).toBe('영수증.jpg')
  expect(fitFileName(`${'가'.repeat(250)}.jpeg`, 200)).toBe(`${'가'.repeat(195)}.jpeg`)
  expect(fitFileName('😀'.repeat(300), 200)).toBe('😀'.repeat(200))
  expect(fitFileName('   ', 200)).toBe('증빙')
})

test('정산된 행사의 지출을 바꾸려 하면 다시 열라고 안내한다', () => {
  expect(expenseMessage('EVENT_SETTLED')).toBe('정산이 끝난 행사라 바꿀 수 없어요. 행사 재정 탭에서 정산을 다시 연 뒤 해 주세요.')
})

test('상시 운영 지출은 운영 항목을 붙여 보이고, 처리 기록은 운영 항목 변경을 적는다', () => {
  expect(eventText({ event: null, budgetLine: { id: 'lo', name: '회의비' } })).toBe('상시 운영 · 회의비')
  expect(eventText({ event: null, budgetLine: null })).toBe('상시 운영')
  expect(historyText({ id: 'h', action: 'updated', actor: { id: 'f', name: '재정' }, changes: { budgetLine: { from: null, to: '회의비' } },
    createdAt: '2026-10-10T01:00:00.000Z' })).toBe('수정: 운영 항목 없음 → 회의비')
  expect(expenseMessage('BUDGET_LINE_INVALID')).toBe('운영 항목을 다시 골라 주세요.')
  expect(expenseMessage('PERIOD_CLOSED')).toBe('마감한 회계 기간의 지출이라 바꿀 수 없어요. 예산 화면에서 마감을 다시 연 뒤 해 주세요.')
})
