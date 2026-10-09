import type { BudgetEventLine, BudgetPeriodSummary, BudgetPlanResponse } from '@vada/contracts'

// 화면 테스트용 기간과 편성. 기본은 2026년 2학기에 수입 1줄, 체육대회 1개, 운영 1줄이 있는 편성이다.
export const budgetPeriod = (overrides: Partial<BudgetPeriodSummary> = {}): BudgetPeriodSummary => ({ id: 'p1', name: '2026년 2학기',
  startsOn: '2026-09-01', endsOn: '2027-02-28', operating: [{ id: 'lo', name: '회의비' }], ...overrides })
export const budgetEventLine = (overrides: Partial<BudgetEventLine> = {}): BudgetEventLine => ({ eventId: 'e', name: '체육대회', budget: 300000,
  spent: 57000, planned: 23180, plannedUnknown: 0, remaining: 219820, settled: false, version: 1, ...overrides })
export function budgetPlan(overrides: Partial<BudgetPlanResponse> = {}): BudgetPlanResponse {
  return {
    period: { id: 'p1', name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28', version: 2 },
    incomes: [{ id: 'li', name: '학생회비', amount: 800000 }],
    events: [budgetEventLine()],
    operating: [{ id: 'lo', name: '회의비', amount: 100000, spent: 12000, remaining: 88000, expenseCount: 1 }],
    unassigned: { spent: 0, count: 0 },
    totals: { income: 800000, budget: 400000, undecided: 0, spent: 69000, planned: 23180, plannedUnknown: 0, remaining: 307820 },
    candidates: [{ eventId: 'e2', name: '축제', budget: null, version: 0, settled: false, spent: 0 }],
    notices: { eventsWithSpending: 0, operatingOutside: 0 },
    history: [],
    ...overrides,
  }
}
