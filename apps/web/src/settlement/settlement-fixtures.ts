import type { EventFinance, EventFinanceResponse } from '@vada/contracts'

// 화면 테스트용 행사 재정. 기본은 예산 미정이고, 지출·품목이 없어 바로 정산할 수 있는 상태다.
export const eventFinance = (overrides: Partial<EventFinance> = {}): EventFinance => ({ eventId: 'e', budget: null, spent: 0, planned: 0,
  plannedUnknown: 0, remaining: null, expenseCount: 0, missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0, settled: null, periodClosed: false, version: 0,
  history: [], fees: null, period: null, feeIncome: null, ...overrides })
export const financeResponse = (overrides: Partial<EventFinance> = {}, rest: Partial<Omit<EventFinanceResponse, 'finance'>> = {}): EventFinanceResponse =>
  ({ finance: eventFinance(overrides), expenses: [], truncated: false, ...rest })
