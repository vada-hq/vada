import type { ExpenseApproval, ExpenseChange, ExpenseVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'

const UNKNOWN_PERSON = '알 수 없는 사람'

const CHANGE_TEXT: Record<ExpenseChange['field'], string> = {
  created: '적음',
  cancelled: '취소함',
  reimbursed: '환급함',
  reason: '사유를 고침',
  event: '행사를 바꿈',
  account: '계좌를 바꿈',
}

// 결재 한 줄: '이름 · 10월 21일 14:03 · 승인'. 지출은 적은 사람의 승인이 같이 남는다(DEC-41).
export function approvalLine(approval: ExpenseApproval) {
  return [
    approval.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(approval.at),
    approval.outcome === 'approved' ? '승인' : '반려',
  ].join(' · ')
}

// 이력 한 줄: '이름 · 10월 20일 14:03 · 취소함: 사유'. 사유는 취소할 때 받은 것이다.
export function versionLine(version: ExpenseVersion) {
  const changes = version.changes.map(change => CHANGE_TEXT[change.field]).join(', ')
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.reason ? `${changes}: ${version.reason}` : changes,
  ].join(' · ')
}
