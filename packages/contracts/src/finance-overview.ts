import type { BudgetItemUsage, EventRef, FiscalPeriodView } from './budget.js'

// 재정 첫 화면(개요)의 응답(DEC-92, 기능 024 조각 8). 숫자는 예산 셈(약정과 사용 가능) 한 곳에서 오고 결산서를 읽지 않는다.
// 공개 전 결산서에만 있는 값(수입 실적, 계좌별 남은 돈)은 싣지 않는다(DEC-70). 홈의 재정 요약도 같은 셈을 쓸 예정이다(DEC-95, 아직 연결하지 않음).

// 지출 예산 항목 한 줄. 예산 탭의 같은 항목과 숫자가 같다.
export type FinanceOverviewItem = Extract<BudgetItemUsage, { type: 'expense' }> & {
  id: string
  purpose: string
  amount: number
  event: EventRef | null
}

// 행사 한 줄: 그 행사를 고른 지출 예산 항목들의 합.
export interface FinanceOverviewEvent {
  event: EventRef
  amount: number
  actual: number
  committed: number
  available: number
}

// 최근 지출 한 줄
export interface FinanceOverviewExpense {
  id: string
  // 결제일(한국 날짜 YYYY-MM-DD)
  paidOn: string
  description: string
  vendor: string
  amount: number
  event: EventRef | null
}

export interface FinanceOverview {
  period: FiscalPeriodView
  // 총예산 = 수입 예산 항목 금액의 합(DEC-92). sources는 그 항목 이름(목적순).
  total: number
  sources: string[]
  // 실제 지출 = 지출 예산 항목의 실제 합 + 예산 항목 없는 지출(noItem).
  actual: number
  committed: number
  // 사용 가능 = 총예산 − 실제 지출 − 지출 예정(음수면 넘게 쓰거나 승인했다).
  available: number
  // 실제 지출에 든 지출 수, 지출 예정에 든 품목 수
  paidCount: number
  committedCount: number
  events: FinanceOverviewEvent[]
  items: FinanceOverviewItem[]
  noItem: number
  recent: FinanceOverviewExpense[]
}

// 고른 기간(없으면 오늘이 든 기간)이 없으면 overview가 null이다.
export interface FinanceOverviewResponse {
  overview: FinanceOverview | null
}

// 최근 지출은 3건(와이어프레임 FIN-00).
export const FINANCE_RECENT_EXPENSES = 3

// 약정 셈과 같은 조건의 품목별 남은 결제 금액. 일부 결제한 품목도 남은 금액만 보인다.
export interface FinanceCommitment {
  id: string
  name: string
  requestId: string
  requestTitle: string
  event: EventRef | null
  budgetItem: { id: string; purpose: string }
  amount: number
}
export interface FinanceCommitmentsResponse {
  items: FinanceCommitment[]
}
