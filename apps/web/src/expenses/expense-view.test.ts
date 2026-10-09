import { expect, test } from 'vitest'
import type { ExpenseAction } from '@vada/contracts'
import { comparisonText, dayText, fitFileName, groupByMonth, historyText } from './expense-view'

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
