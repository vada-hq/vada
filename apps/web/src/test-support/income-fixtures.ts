import type { FiscalPeriodSummary, IncomeDetail, IncomeSummary } from '@vada/contracts'

// 수입 화면 시험이 같이 쓰는 응답. 값은 서버 응답과 같은 모양이다. 지금 기간은 오늘이 언제든 들도록 넓게 잡는다.
export const CURRENT_PERIOD = '77777777-7777-4777-8777-777777777771'
export const OLD_PERIOD = '77777777-7777-4777-8777-777777777772'
export const INCOME_ITEM = '88888888-8888-4888-8888-888888888881'

export const periodSummary = (
  id: string,
  extra: Partial<FiscalPeriodSummary> = {},
): FiscalPeriodSummary => ({
  id,
  name: '2026년 2학기',
  startsOn: '2000-01-01',
  endsOn: '2999-12-31',
  previousPeriodId: null,
  current: true,
  status: 'draft',
  publishedAt: null,
  ...extra,
})

export const standardPeriods = () => ({
  periods: [
    periodSummary(CURRENT_PERIOD),
    periodSummary(OLD_PERIOD, {
      name: '2026년 1학기',
      startsOn: '1990-01-01',
      endsOn: '1999-12-31',
      current: false,
      status: 'published',
    }),
  ],
})

export const incomeSummary = (id: string, extra: Partial<IncomeSummary> = {}): IncomeSummary => ({
  id,
  source: 'grant',
  amount: 500000,
  receivedOn: '2026-10-20',
  description: `내용 ${id}`,
  budgetItem: null,
  account: { id: 'a1', name: '학생회비 통장' },
  createdBy: { id: 'm2', name: '이재정' },
  cancelled: false,
  ...extra,
})

export const incomeDetail = (id = 'i1', extra: Partial<IncomeDetail> = {}): IncomeDetail => ({
  ...incomeSummary(id),
  period: { id: CURRENT_PERIOD, name: '2026년 2학기' },
  history: [
    {
      versionNo: 1,
      at: '2026-10-20T05:03:00.000Z',
      by: { id: 'm2', name: '이재정' },
      changes: [{ field: 'created' }],
      reason: null,
    },
  ],
  actions: ['income.cancel'],
  ...extra,
})
