import type { IncomeAction, IncomeHistoryEntry } from '@vada/contracts'
import { won } from '../purchases/purchase-view'

const actionLabels: Record<IncomeAction, string> = { created: '기록', updated: '수정', voided: '취소' }
const fieldLabels: Record<string, string> = { description: '내용', amount: '금액', receivedOn: '받은 날', note: '메모', budgetLine: '수입 항목' }
function valueText(key: string, value: unknown) {
  if (value === null || value === undefined) return '없음'
  if (key === 'amount' && typeof value === 'number') return won(value)
  return String(value)
}
// 처리 기록 한 줄. 수정은 바뀐 칸을 이전 → 이후로 적는다.
export function incomeHistoryText(entry: IncomeHistoryEntry) {
  if (entry.action === 'updated') {
    const parts = Object.entries(entry.changes).map(([key, change]) => {
      const { from, to } = change as { from: unknown; to: unknown }
      return `${fieldLabels[key] ?? key} ${valueText(key, from)} → ${valueText(key, to)}`
    })
    return `${actionLabels.updated}: ${parts.join(' · ')}`
  }
  if (entry.action === 'voided') return `${actionLabels.voided}: ${String(entry.changes.reason ?? '')}`
  return actionLabels.created
}
// 받은 날의 기본값. 오늘이 기간 밖이면 가까운 쪽 끝날이다.
export const defaultReceivedOn = (period: { startsOn: string; endsOn: string }, today: string) =>
  today < period.startsOn ? period.startsOn : today > period.endsOn ? period.endsOn : today

export const incomeErrors: Record<string, string> = {
  FORBIDDEN: '권한이 없어요. 재정 부서나 회장단만 할 수 있어요.',
  NOT_FOUND: '수입을 찾을 수 없어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.',
  INVALID_STATE: '취소된 수입은 바꿀 수 없어요.',
  DATE_OUTSIDE_PERIOD: '받은 날이 이 회계 기간 밖이에요.',
  BUDGET_LINE_INVALID: '수입 항목을 다시 골라 주세요.',
  PERIOD_CLOSED: '마감한 기간이라 수입을 바꿀 수 없어요.',
  CARRYOVER_INCOME: '앞 기간에서 넘어온 이월금은 바꿀 수 없어요.',
  FEE_INCOME: '행사 정산에서 넣은 참가비 수입은 바꿀 수 없어요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const incomeFailure = '처리하지 못했어요. 다시 시도해 주세요.'
export const incomeMessage = (code: unknown) => typeof code === 'string' ? incomeErrors[code] ?? incomeFailure : incomeFailure
