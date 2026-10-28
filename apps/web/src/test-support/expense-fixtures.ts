import type { ExpenseDetail, ExpenseSummary } from '@vada/contracts'

// 지출 화면 시험이 같이 쓰는 응답. 값은 서버 응답과 같은 모양이다.
export const expenseSummary = (
  id: string,
  extra: Partial<ExpenseSummary> = {},
): ExpenseSummary => ({
  id,
  vendor: `사용처 ${id}`,
  description: '포스터 인쇄',
  amount: 36000,
  paidOn: '2026-10-20',
  method: 'card',
  paidBy: null,
  reimbursed: false,
  evidenceCount: 1,
  cancelled: false,
  event: null,
  departments: [],
  ...extra,
})

export const expenseDetail = (id = 'e1', extra: Partial<ExpenseDetail> = {}): ExpenseDetail => ({
  ...expenseSummary(id, { vendor: '인쇄소', paidBy: { id: 'm3', name: '박새내' } }),
  reason: null,
  requestedBy: null,
  budgetItem: null,
  account: null,
  lines: [],
  evidence: [],
  approvals: [
    {
      id: 'a1',
      by: { id: 'm2', name: '이재정' },
      at: '2026-10-20T05:03:00.000Z',
      outcome: 'approved',
    },
  ],
  history: [
    {
      versionNo: 1,
      at: '2026-10-20T05:03:00.000Z',
      by: { id: 'm2', name: '이재정' },
      changes: [{ field: 'created' }],
      reason: null,
    },
  ],
  actions: ['expense.cancel', 'expense.reimburse', 'expense.update', 'expense.attach_evidence'],
  ...extra,
})
