import type { Applicant, ApplicantDeposit } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import { ApplicantActions } from './ApplicantActions'
import { DepositActions } from './DepositActions'
import { DEPOSIT_LABEL, type StaffCan } from './registration-view'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  attended: boolean
  // 출석·신청 취소는 관리 권한자에게, 입금 확인·확인 취소는 입금 확인 권한자에게, 환불함은 재정부에게만 있다.
  can: StaffCan
  onAttendance: (registrationId: string, attended: boolean) => void
  onCancelled: (registrationId: string, refundPending: boolean) => void
  onDeposit: (registrationId: string, deposit: ApplicantDeposit) => void
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
// 취소했지만 입금이 남은 신청(환불 대기)은 출석과 신청 취소 대신 입금 동작만 있다.
export function ApplicantRow({ applicant, attended, can, onDeposit, ...rest }: Props) {
  const details = [
    applicant.studentId && `학번 ${applicant.studentId}`,
    applicant.phone,
    won(applicant.appliedFee),
  ]
  const { onAttendance, onCancelled, ...handlers } = rest
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
        {attended && <Badge tone="success">출석</Badge>}
      </div>
      <p className="text-xs text-gray-500 wrap-anywhere">{details.filter(Boolean).join(' · ')}</p>
      {can.manage && !applicant.cancelled && (
        <ApplicantActions
          applicant={applicant}
          attended={attended}
          onAttendance={onAttendance}
          onCancelled={onCancelled}
          {...handlers}
        />
      )}
      <DepositActions
        applicant={applicant}
        can={can}
        onDeposit={onDeposit}
        onGone={() => onCancelled(applicant.id, false)}
        {...handlers}
      />
    </li>
  )
}
