import type { PurchaseChange, PurchaseDecision, PurchaseVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'

const UNKNOWN_PERSON = '알 수 없는 사람'

// 결재 한 줄: '이름 · 10월 21일 14:03 · 반려: 사유'
export function decisionLine(decision: PurchaseDecision) {
  const outcome =
    decision.outcome === 'approved'
      ? '승인'
      : `반려${decision.reason ? `: ${decision.reason}` : ''}`
  return [decision.by?.name ?? UNKNOWN_PERSON, monthDayTime(decision.at), outcome].join(' · ')
}

const changeText = (change: PurchaseChange) => (change.field === 'created' ? '요청함' : '취소함')

// 이력 한 줄: '이름 · 10월 20일 14:03 · 요청함'
export function versionLine(version: PurchaseVersion) {
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.changes.map(changeText).join(', '),
  ].join(' · ')
}
