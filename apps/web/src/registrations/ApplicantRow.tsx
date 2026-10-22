import type { Applicant } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import { ApplicantActions } from './ApplicantActions'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  attended: boolean
  // 출석·출석 취소·신청 취소 버튼은 관리 권한자에게만 있다.
  canManage: boolean
  onAttendance: (registrationId: string, attended: boolean) => void
  onCancelled: (registrationId: string) => void
}

// 신청자 한 명: 이름, 학번, 휴대폰, 적용 참가비, 칩(납부자·같은 학번·출석), 출석과 취소.
export function ApplicantRow({ applicant, attended, canManage, ...rest }: Props) {
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
        {applicant.payer !== null && (
          <Badge tone={applicant.payer ? 'success' : 'warning'}>
            {applicant.payer ? '납부자' : '미납자'}
          </Badge>
        )}
        {applicant.duplicateStudentId && <Badge tone="danger">같은 학번</Badge>}
        {attended && <Badge tone="success">출석</Badge>}
      </div>
      <p className="text-xs text-gray-500 wrap-anywhere">{details.filter(Boolean).join(' · ')}</p>
      {canManage && <ApplicantActions applicant={applicant} attended={attended} {...rest} />}
    </li>
  )
}
