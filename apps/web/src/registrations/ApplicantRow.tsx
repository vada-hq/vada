import type { Applicant, ApplicantChange } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import { ApplicantActions } from './ApplicantActions'
import { DepositActions } from './DepositActions'
import { DEPOSIT_LABEL } from './registration-view'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  // 쓰기가 돌려준 줄의 새 모습. 신청이 없어졌으면(404) onGone이다.
  onChange: (change: ApplicantChange) => void
  onGone: () => void
}

// 입금 칩. 참가비가 없는 신청의 '입금 안 함'은 보이지 않는다.
function DepositBadge({ applicant }: { applicant: Applicant }) {
  const { status, amount } = applicant.deposit
  if (status === 'none' && applicant.appliedFee === 0) return null
  const tone = {
    none: 'neutral',
    confirmed: 'success',
    refund_pending: 'warning',
    refunded: 'info',
  } as const
  return (
    <Badge tone={tone[status]}>
      {DEPOSIT_LABEL[status]}
      {amount !== null && ` ${won(amount)}`}
    </Badge>
  )
}

// 신청자 한 명: 이름, 학번, 휴대폰, 적용 참가비, 칩(입금·납부자·같은 학번·출석), 출석·취소와 입금 동작.
// 버튼은 그 줄의 actions(서버가 준 동작)에 있는 것만 보인다.
export function ApplicantRow({ applicant, ...rest }: Props) {
  const details = [
    applicant.studentId && `학번 ${applicant.studentId}`,
    applicant.phone,
    won(applicant.appliedFee),
  ]
  return (
    <li className="flex flex-col gap-2 rounded-md border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900 wrap-anywhere">
          {applicant.name}
        </p>
        <DepositBadge applicant={applicant} />
        {applicant.cancelled && <Badge tone="danger">취소함</Badge>}
        {applicant.payer !== null && (
          <Badge tone={applicant.payer ? 'success' : 'warning'}>
            {applicant.payer ? '납부자' : '미납자'}
          </Badge>
        )}
        {applicant.duplicateStudentId && <Badge tone="danger">같은 학번</Badge>}
        {applicant.attended && <Badge tone="success">출석</Badge>}
      </div>
      <p className="text-xs text-gray-500 wrap-anywhere">{details.filter(Boolean).join(' · ')}</p>
      <ApplicantActions applicant={applicant} {...rest} />
      <DepositActions applicant={applicant} {...rest} />
    </li>
  )
}
