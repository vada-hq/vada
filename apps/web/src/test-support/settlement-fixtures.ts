import type { EventSettlement, SettlementResponse } from '@vada/contracts'

// 행사 돈 탭 시험이 같이 쓰는 정산 응답. 값은 서버 응답과 같은 모양이다.
export const settlementOf = (extra: Partial<EventSettlement> = {}): SettlementResponse => ({
  settlement: {
    budget: {
      expense: 500000,
      income: 0,
      items: [
        {
          id: 'b1',
          type: 'expense',
          purpose: '간식',
          amount: 300000,
          actual: 36000,
          committed: 14000,
          available: 250000,
        },
      ],
    },
    actual: { expense: 36000, fee: 40000, income: 0, depositCount: 2, refundPendingCount: 0 },
    difference: 464000,
    remaining: [
      { kind: 'pending_items', count: 0, targets: [] },
      {
        kind: 'no_reason',
        count: 1,
        targets: [{ type: 'expense', id: 'x1', vendor: '인쇄소', amount: 36000 }],
      },
      {
        kind: 'unpaid_items',
        count: 3,
        targets: [{ type: 'request', id: 'r1', title: '포스터 인쇄' }],
      },
    ],
    settled: false,
    completed: false,
    approvals: [],
    ...extra,
  },
})
