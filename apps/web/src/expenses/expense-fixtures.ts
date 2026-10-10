import type { ExpenseDetail, ExpenseItem } from '@vada/contracts'

// 화면 테스트용 연결 품목과 지출. 기본은 체육대회의 증빙 없는 학생회 카드 결제다.
export const expenseItem = (overrides: Partial<ExpenseItem> = {}): ExpenseItem => ({ id: 'i1', event: { id: 'e', name: '체육대회' },
  productName: '박스테이프', quantity: 2, estimatedUnitPrice: 4900, requester: { id: 'u', name: '기획 테스터' },
  purchasedAt: '2026-10-08T06:00:00.000Z', ...overrides })
export function expense(overrides: Partial<ExpenseDetail> = {}): ExpenseDetail {
  return {
    id: 'x1', event: { id: 'e', name: '체육대회' }, budgetLine: null, vendor: '쿠팡', description: '체육대회 물품', amount: 10000, paidOn: '2026-10-09',
    method: 'council_card', payer: { id: 'f', name: '재정 테스터' }, payerMembershipId: 'mf', note: null,
    recordedBy: { id: 'f', name: '재정 테스터' }, items: [expenseItem()], approvedTotal: 9800, receiptCount: 0, evidence: 'missing',
    voided: null, settled: false, periodClosed: false, version: 1, createdAt: '2026-10-09T05:00:00.000Z', updatedAt: '2026-10-09T05:00:00.000Z', receipts: [], history: [],
    ...overrides,
  }
}
