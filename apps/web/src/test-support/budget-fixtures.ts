import type { BudgetItemVersion, BudgetResponse } from '@vada/contracts'

// 예산 화면 시험이 같이 쓰는 응답. 번호는 서버처럼 UUID다(계약 검사가 UUID만 받는다).
export const BUDGET_A = '11111111-1111-4111-8111-111111111111'
export const BUDGET_B = '22222222-2222-4222-8222-222222222222'
export const LINE_1 = '33333333-3333-4333-8333-333333333333'
export const LINE_2 = '44444444-4444-4444-8444-444444444444'

// 만든 판 하나(재정부가 만듦)
const firstVersion = (purpose: string, amount: number): BudgetItemVersion => ({
  versionNo: 1,
  at: '2026-09-01T03:00:00.000Z',
  by: { id: 'm1', name: '김재정' },
  purpose,
  amount,
  reason: null,
})

export const budgetWithPeriod = (): BudgetResponse => ({
  period: { id: 'p1', name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' },
  items: [
    {
      id: BUDGET_A,
      purpose: '행사 홍보',
      amount: 300000,
      type: 'expense',
      event: null,
      department: null,
      selectable: true,
      actual: 120000,
      committed: 30000,
      available: 150000,
      deletable: true,
      history: [firstVersion('행사 홍보', 300000)],
    },
    {
      id: BUDGET_B,
      purpose: '소모품',
      amount: 50000,
      type: 'expense',
      event: null,
      department: null,
      selectable: true,
      actual: 20000,
      committed: 40000,
      available: -10000,
      deletable: true,
      history: [firstVersion('소모품', 50000)],
    },
  ],
})

export const budgetWithoutPeriod = (): BudgetResponse => ({
  period: null,
  items: [],
})
