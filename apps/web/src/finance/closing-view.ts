import type { ClosingCheckKind, ClosingStatus, FiscalPeriodSummary } from '@vada/contracts'
import { wonLabel } from './purchase-view'

export const STATUS_LABEL: Record<ClosingStatus, string> = {
  draft: '작성 중',
  published: '공개됨',
}
export const STATUS_TONE: Record<ClosingStatus, 'warning' | 'success'> = {
  draft: 'warning',
  published: 'success',
}

export const CHECK_LABEL: Record<ClosingCheckKind, string> = {
  no_evidence: '증빙이 없는 지출',
  no_reason: '사유가 없는 지출',
  unreimbursed: '환급 전 지출',
  no_account: '계좌가 없는 지출',
  no_item: '예산 항목이 없는 지출',
  other_period_item: '다른 기간 예산 항목을 고른 지출',
}

// 음수(남은 돈이 모자람, 차이)는 부호를 붙여 적는다.
export const signedWon = (amount: number) =>
  amount < 0 ? `-${wonLabel(-amount)}` : wonLabel(amount)

// 기본으로 열 기간: 끝났고 공개하지 않은 기간 가운데 가장 이른 것. 없으면 지금 기간(chosenPeriod가 이어서 고른다).
// periods는 시작이 늦은 순이다. 끝났는지는 서버가 준 오늘(한국)과 끝일로 본다.
export function defaultClosingPeriod(periods: FiscalPeriodSummary[], today: string) {
  const open = periods.filter(period => period.status === 'draft' && period.endsOn < today)
  return open.at(-1)?.id ?? null
}
