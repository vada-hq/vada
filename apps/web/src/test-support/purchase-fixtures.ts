import type { PurchaseRequestDetail, PurchaseRequestSummary } from '@vada/contracts'

// 구매 요청 화면 시험이 같이 쓰는 응답. 값은 서버 응답과 같은 모양이다.
export const purchaseSummary = (
  id: string,
  extra: Partial<PurchaseRequestSummary> = {},
): PurchaseRequestSummary => ({
  id,
  title: `요청 ${id}`,
  status: 'pending',
  requestedBy: { id: 'm1', name: '김회장' },
  neededBy: '2026-10-25',
  itemCount: 2,
  createdAt: '2026-10-21T05:03:00.000Z',
  event: null,
  ...extra,
})

export const purchaseDetail = (
  id = 'r1',
  extra: Partial<PurchaseRequestDetail> = {},
): PurchaseRequestDetail => ({
  ...purchaseSummary(id, { title: '행사 포스터 인쇄' }),
  body: '10월 말 행사용이에요.',
  items: [
    {
      id: 'i1',
      name: 'A2 포스터',
      quantity: 3,
      link: 'https://example.com/poster',
      options: '무광',
      amount: null,
      budgetItem: null,
      status: 'pending',
      paid: false,
      actions: [],
    },
    {
      id: 'i2',
      name: '테이프',
      quantity: 1,
      link: null,
      options: null,
      amount: 12000,
      budgetItem: { id: 'b1', purpose: '행사 홍보' },
      status: 'rejected',
      paid: false,
      actions: [],
    },
  ],
  decisions: [
    {
      id: 'd1',
      lineItemId: 'i2',
      outcome: 'rejected',
      by: { id: 'm2', name: '이재정' },
      at: '2026-10-21T05:03:00.000Z',
      reason: '이미 있어요',
    },
  ],
  expenses: [],
  history: [
    {
      versionNo: 1,
      at: '2026-10-20T05:03:00.000Z',
      by: { id: 'm1', name: '김회장' },
      changes: [{ field: 'created' }],
    },
  ],
  actions: ['purchase.cancel'],
  ...extra,
})
