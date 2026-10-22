import { z } from 'zod'
import { text } from './input.js'
import type { IncomeSource } from './incomes.js'
import { PURCHASE_REASON_MAX } from './purchases.js'
import type { SettlementTarget } from './settlement.js'

// 결산서 읽기(기능 009). 돈은 모두 정수 원이다.

// 엑셀과 증빙 묶음 상한. 넘으면 내보내기를 막는다(Render 512MB, 대역폭).
export const CLOSING_EXPORT_MAX_ROWS = 1000
export const CLOSING_EXPORT_MAX_PHOTOS = 2000
export const CLOSING_EXPORT_MAX_BYTES = 1_000_000_000

export type ClosingStatus = 'draft' | 'published'

export interface FiscalPeriodSummary {
  id: string
  name: string
  startsOn: string
  endsOn: string
  previousPeriodId: string | null
  // 오늘(한국)이 든 기간
  current: boolean
  status: ClosingStatus
  // ISO. 공개 전에는 null
  publishedAt: string | null
}

// 시작이 늦은 순
export interface FiscalPeriodsResponse {
  periods: FiscalPeriodSummary[]
}

// 예산 항목 하나의 예산과 결산. 차이는 수입이면 결산 − 예산, 지출이면 예산 − 결산이다.
// rate는 결산 ÷ 예산(%, 반올림)이고 예산이 0이면 null이다.
export interface ClosingLine {
  id: string
  purpose: string
  budget: number
  actual: number
  difference: number
  rate: number | null
}

export interface ClosingSourceTotal {
  source: IncomeSource
  count: number
  amount: number
}

export interface ClosingIncome {
  // 전기 이월금(수입 합에 들어 있다)
  carryover: number
  items: ClosingLine[]
  // 수입 항목을 고르지 않은 수입(이월금 빼고)
  noItem: number
  // 출처별. 참가비 줄은 참가비 수입 합 그대로다(환불을 다시 빼지 않는다).
  bySource: ClosingSourceTotal[]
  total: number
}

export interface ClosingExpense {
  items: ClosingLine[]
  noItem: number
  // 다른 기간 예산 항목을 고른 지출
  otherPeriod: number
  total: number
}

// 계좌마다. 이월금은 넣지 않는다. account가 null이면 '계좌 미지정' 줄이다.
export interface ClosingAccountLine {
  account: { id: string; name: string; closed: boolean } | null
  income: number
  expense: number
  difference: number
}

export const CLOSING_CHECK_KINDS = [
  'no_evidence',
  'no_reason',
  'unreimbursed',
  'no_account',
  'no_item',
  'other_period_item',
] as const
export type ClosingCheckKind = (typeof CLOSING_CHECK_KINDS)[number]

// 수는 전체, 목록은 상한(SETTLEMENT_TARGET_LIMIT)까지다. 공개를 막지 않는다.
export interface ClosingCheck {
  kind: ClosingCheckKind
  count: number
  targets: SettlementTarget[]
}

// 완료하지 않은 행사의 입금(입금 확인일이 끝일 이하, 취소하지 않은 것, 환불을 뺀 금액)
export interface ClosingPendingEvent {
  event: { id: string; name: string }
  depositCount: number
  amount: number
}

export interface ClosingFeePending {
  // 끝 날짜가 이 기간 안이거나 날짜 미정인 행사. 공개를 막는다.
  blocking: ClosingPendingEvent[]
  // 끝 날짜가 뒤 기간인 행사의 입금. 선수금이라 막지 않고 정보로만 보인다.
  nextPeriod: { eventCount: number; depositCount: number; amount: number }
}

export interface ClosingExportInfo {
  expenseCount: number
  incomeCount: number
  photoCount: number
  photoBytes: number
  tooLarge: boolean
}

export const CLOSING_ACTIONS = [
  'closing.publish',
  'closing.reopen',
  'closing.export_public',
  'closing.export_audit',
] as const
export type ClosingAction = (typeof CLOSING_ACTIONS)[number]

export interface Closing {
  period: { id: string; name: string; startsOn: string; endsOn: string }
  status: ClosingStatus
  publishedAt: string | null
  income: ClosingIncome
  expense: ClosingExpense
  // 남은 돈 = 전기 이월금을 포함한 수입 합 − 지출 합
  remaining: number
  accounts: ClosingAccountLine[]
  checks: ClosingCheck[]
  feePending: ClosingFeePending
  exportInfo: ClosingExportInfo
  actions: ClosingAction[]
}

export interface ClosingResponse {
  closing: Closing
}

// 공개는 본문이 없다. 다시 열기는 사유가 꼭 있고 판과 이월금 취소에 남는다(PRIN-3).
export const PublishClosingSchema = z.strictObject({})
export const ReopenClosingSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
