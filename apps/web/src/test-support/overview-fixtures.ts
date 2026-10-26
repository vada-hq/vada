import type { FinanceOverview } from '@vada/contracts'
import { CURRENT_PERIOD } from './income-fixtures'

// 재정 첫 화면(개요) 응답. 값은 서버 응답과 같은 모양이고 숫자는 서로 맞는다(사용 가능 = 총예산 − 실제 − 예정).
export const OVERVIEW_EVENT = '99999999-9999-4999-8999-999999999991'
export const OVERVIEW_EXPENSE = '99999999-9999-4999-8999-999999999992'

export const overviewFixture = (extra: Partial<FinanceOverview> = {}): FinanceOverview => ({
  period: {
    id: CURRENT_PERIOD,
    name: '2026년 2학기',
    startsOn: '2026-07-01',
    endsOn: '2026-12-31',
  },
  total: 1_000_000,
  sources: ['지원금', '학생회비'],
  actual: 413_000,
  committed: 104_000,
  available: 483_000,
  paidCount: 4,
  committedCount: 2,
  events: [
    {
      event: { id: OVERVIEW_EVENT, name: '체육대회' },
      amount: 500_000,
      actual: 210_000,
      committed: 60_000,
      available: 230_000,
    },
  ],
  items: [
    {
      id: 'b1',
      type: 'expense',
      purpose: '식비',
      amount: 500_000,
      actual: 210_000,
      committed: 60_000,
      available: 230_000,
      event: { id: OVERVIEW_EVENT, name: '체육대회' },
    },
    {
      id: 'b2',
      type: 'expense',
      purpose: '비품',
      amount: 300_000,
      actual: 200_000,
      committed: 44_000,
      available: 56_000,
      event: null,
    },
  ],
  noItem: 3_000,
  recent: [
    {
      id: OVERVIEW_EXPENSE,
      paidOn: '2026-10-17',
      description: '현수막 제작',
      vendor: '인쇄소',
      amount: 180_000,
      event: { id: OVERVIEW_EVENT, name: '체육대회' },
    },
    {
      id: '99999999-9999-4999-8999-999999999993',
      paidOn: '2026-10-16',
      description: '생수 구매',
      vendor: '편의점',
      amount: 120_000,
      event: null,
    },
  ],
  ...extra,
})
