import type { BudgetEventLine, BudgetPeriodSummary, BudgetPlanResponse, IncomeDetail, IncomeSummary } from '@vada/contracts'

// 화면 테스트용 기간과 편성. 기본은 2026년 2학기에 수입 1줄, 체육대회 1개, 운영 1줄이 있는 편성이다.
export const budgetPeriod = (overrides: Partial<BudgetPeriodSummary> = {}): BudgetPeriodSummary => ({ id: 'p1', name: '2026년 2학기',
  startsOn: '2026-09-01', endsOn: '2027-02-28', closed: false, operating: [{ id: 'lo', name: '회의비' }], ...overrides })
export const budgetEventLine = (overrides: Partial<BudgetEventLine> = {}): BudgetEventLine => ({ eventId: 'e', name: '체육대회', budget: 300000,
  spent: 57000, planned: 23180, plannedUnknown: 0, remaining: 219820, settled: false, version: 1, ...overrides })
// 2026년 2학기의 수입 한 건. 기본은 학생회비 줄을 고른 75만 원이다.
export const incomeSummary = (overrides: Partial<IncomeSummary> = {}): IncomeSummary => ({ id: 'i1', budgetLine: { id: 'li', name: '학생회비' },
  description: '2학기 학생회비', amount: 750000, receivedOn: '2026-09-15', note: null, recordedBy: { id: 'f', name: '재정' }, voided: null, carriedFrom: null, version: 1,
  createdAt: '2026-09-15T03:00:00.000Z', updatedAt: '2026-09-15T03:00:00.000Z', ...overrides })
export const incomeDetail = (overrides: Partial<IncomeDetail> = {}): IncomeDetail => ({ ...incomeSummary(),
  history: [{ id: 'h1', action: 'created', actor: { id: 'f', name: '재정' }, changes: {}, createdAt: '2026-09-15T03:00:00.000Z' }], ...overrides })
export function budgetPlan(overrides: Partial<BudgetPlanResponse> = {}): BudgetPlanResponse {
  return {
    period: { id: 'p1', name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28', version: 2, closed: null },
    // 끝나지 않은 열린 기간. 마감 조건을 볼 때는 ended를 true로 바꾼다.
    closing: { ended: false, earlierOpen: null, missingEvidence: 0, next: null, carriedOver: null },
    incomes: [{ id: 'li', name: '학생회비', amount: 800000, received: 0, incomeCount: 0 }],
    events: [budgetEventLine()],
    operating: [{ id: 'lo', name: '회의비', amount: 100000, spent: 12000, remaining: 88000, expenseCount: 1 }],
    unassigned: { spent: 0, count: 0 },
    unassignedIncome: { received: 0, count: 0 },
    totals: { income: 800000, received: 0, budget: 400000, undecided: 0, spent: 69000, planned: 23180, plannedUnknown: 0, remaining: 307820,
      balance: -69000 },
    candidates: [{ eventId: 'e2', name: '축제', budget: null, version: 0, settled: false, spent: 0 }],
    notices: { eventsWithSpending: 0, operatingOutside: 0 },
    history: [],
    incomeRecords: [],
    incomeRecordsTruncated: false,
    ...overrides,
  }
}
