import type { EventFinance, EventFinanceHistoryEntry } from '@vada/contracts'
import { won } from '../purchases/purchase-view'
import { completedEventMessage } from '../events/event-phase'

export const budgetText = (budget: number | null) => budget === null ? '미정' : won(budget)
// 예산 칸의 글. 쉼표·공백·"원"은 지우고, 비우면 미정(null)이다. 숫자가 아닌 글자가 남으면 NaN이라 같은 스키마가 저장 버튼을 끈다.
// 숫자 칸(type=number)은 "300,000"처럼 읽지 못하는 글을 빈 값으로 넘겨 미정으로 저장되므로 글 칸으로 받는다.
export function budgetInput(text: string): number | null {
  const digits = text.replace(/[,\s원]/g, '')
  if (digits === '') return null
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN
}
// 남은 예산. 예산이 미정이면 —, 0보다 작으면 초과로 적는다.
export const remainingText = (remaining: number | null) => remaining === null ? '—' : remaining < 0 ? `${won(-remaining)} 초과` : won(remaining)

export type Requirement = { key: 'missingEvidence' | 'pendingRequests' | 'unrecordedItems' | 'feePeriod'; label: string; hint: string; done: boolean }
// 정산하려면 셋 다 0이어야 하고, 받은 참가비가 있으면 넣을 회계 기간이 있어야 한다. 해결 방법은 재정 권한자에게만 보인다.
export function requirements(finance: EventFinance): Requirement[] {
  const fees: Requirement[] = finance.fees && finance.fees.received > 0 ? [{ key: 'feePeriod',
    label: finance.period ? `참가비를 넣을 회계 기간: ${finance.period.name}` : '참가비를 넣을 회계 기간이 없어요',
    hint: '예산 화면의 편성 수정에서 이 행사를 회계 기간에 넣어 주세요.', done: finance.period !== null }] : []
  return [
    { key: 'missingEvidence', label: `증빙 누락 ${finance.missingEvidence}건`, hint: '지출 상세에서 증빙을 올려 주세요.', done: finance.missingEvidence === 0 },
    { key: 'pendingRequests', label: `검토 대기 요청 ${finance.pendingRequests}건`, hint: '구매 검토에서 승인하거나 반려해 주세요.',
      done: finance.pendingRequests === 0 },
    { key: 'unrecordedItems', label: `지출로 기록하지 않은 승인 품목 ${finance.unrecordedItems}개`,
      hint: '산 품목은 지출에 연결하고, 사지 않을 품목은 승인을 취소해 주세요.', done: finance.unrecordedItems === 0 },
    ...fees,
  ]
}
export const readyToSettle = (finance: EventFinance) => requirements(finance).every(item => item.done)
// 참가비 수입 항목의 기본값. 이름에 "참가비"가 든 첫 줄이고, 없으면 고르지 않는다('').
export const defaultFeeIncomeLine = (lines: { id: string; name: string }[]) => lines.find(line => line.name.includes('참가비'))?.id ?? ''

// 처리 기록 한 줄.
export function financeHistoryText(entry: EventFinanceHistoryEntry) {
  if (entry.action === 'budget_set') {
    const { from, to } = entry.changes as { from: number | null; to: number | null }
    return `예산 ${budgetText(from)} → ${budgetText(to)}`
  }
  if (entry.action === 'settled') {
    // 참가비 수입을 넣은 정산이면 그 금액과 기간을 붙인다. M3b-2 전 기록에는 fee가 없다.
    const fee = entry.changes.fee as { amount: number; period: string } | null | undefined
    return `정산 완료 · 실제 지출 ${won(Number(entry.changes.spent ?? 0))}${fee ? ` · 참가비 ${won(fee.amount)} → ${fee.period} 수입` : ''}`
  }
  return `정산 다시 엶: ${entry.reason ?? ''}`
}
// 정산한 날(한국 시간). 예: 10월 9일
export const settledDay = (at: string) => new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })

export const settlementErrors: Record<string, string> = {
  FORBIDDEN: '권한이 없어요. 재정 부서나 회장단만 할 수 있어요.',
  NOT_FOUND: '행사를 찾을 수 없어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 새로 불러왔어요.',
  INVALID_STATE: '지금 상태에서는 할 수 없어요. 새로 불러왔어요.',
  NOT_READY_TO_SETTLE: '아직 정산할 수 없어요. 남은 항목을 확인해 주세요.',
  EVENT_SETTLED: '정산이 끝난 행사라 바꿀 수 없어요.',
  EVENT_COMPLETED: completedEventMessage,
  PERIOD_CLOSED: '마감한 회계 기간의 행사라 정산을 다시 열 수 없어요.',
  EXPORT_TOO_LARGE: '지출이 너무 많아 엑셀로 만들 수 없어요.',
  BUDGET_LINE_INVALID: '참가비 수입 항목을 다시 골라 주세요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const settlementFailure = '처리하지 못했어요. 다시 시도해 주세요.'
export const settlementMessage = (code: unknown) => typeof code === 'string' ? settlementErrors[code] ?? settlementFailure : settlementFailure
