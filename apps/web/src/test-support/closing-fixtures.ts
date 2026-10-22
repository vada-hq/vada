import type { Closing } from '@vada/contracts'
import { CURRENT_PERIOD } from './income-fixtures'

// 결산 화면 시험이 같이 쓰는 응답. 값은 서버 응답과 같은 모양이다.
export const closingFixture = (extra: Partial<Closing> = {}): Closing => ({
  period: {
    id: CURRENT_PERIOD,
    name: '2026년 2학기',
    startsOn: '2000-01-01',
    endsOn: '2999-12-31',
  },
  status: 'draft',
  publishedAt: null,
  income: {
    carryover: 100000,
    items: [
      {
        id: 'b1',
        purpose: '지원금 예산',
        budget: 500000,
        actual: 400000,
        difference: -100000,
        rate: null,
      },
    ],
    noItem: 30000,
    bySource: [
      { source: 'carryover', count: 1, amount: 100000 },
      { source: 'grant', count: 2, amount: 430000 },
    ],
    total: 530000,
  },
  expense: {
    items: [
      {
        id: 'b2',
        purpose: '행사 홍보',
        budget: 200000,
        actual: 150000,
        difference: 50000,
        rate: 75,
      },
    ],
    noItem: 20000,
    otherPeriod: 0,
    total: 170000,
  },
  remaining: 360000,
  accounts: [
    {
      account: { id: 'a1', name: '학생회비 통장', closed: false },
      income: 430000,
      expense: 150000,
      difference: 280000,
    },
    { account: null, income: 0, expense: 20000, difference: -20000 },
  ],
  checks: [
    {
      kind: 'no_evidence',
      count: 2,
      targets: [{ type: 'expense', id: 'x1', vendor: '인쇄소', amount: 36000 }],
    },
  ],
  feePending: { blocking: [], nextPeriod: { eventCount: 0, depositCount: 0, amount: 0 } },
  exportInfo: {
    expenseCount: 3,
    incomeCount: 3,
    photoCount: 5,
    photoBytes: 2_000_000,
    workbookTooLarge: false,
    bundleTooLarge: false,
    bundleAvailable: true,
  },
  actions: ['closing.export_public', 'closing.export_audit'],
  ...extra,
})
