import type { SettlementApproval } from '@vada/contracts'
import { dayLabel } from './event-view'

const OUTCOME_LABEL: Record<SettlementApproval['outcome'], string> = {
  completed: '완료',
  completion_cancelled: '완료 취소',
}

// 상태 옆의 완료 사유(DEC-80): 마지막 완료·완료 취소 결재의 이름·날짜·사람과 사유. 결재가 없으면 없다.
// now는 올해 판단용이다(부품 확인 화면이 고정한다).
export function ApprovalNote({ approvals, now }: { approvals: SettlementApproval[]; now?: Date }) {
  const last = approvals.at(-1)
  if (!last) return null
  const head = [OUTCOME_LABEL[last.outcome], dayLabel(last.at, now), last.by?.name]
    .filter(Boolean)
    .join(' · ')
  return (
    <div aria-label="완료 사유" className="flex flex-col text-sm text-gray-500">
      <span className="wrap-anywhere">{head}</span>
      {last.reason && <span className="wrap-anywhere">{last.reason}</span>}
    </div>
  )
}
