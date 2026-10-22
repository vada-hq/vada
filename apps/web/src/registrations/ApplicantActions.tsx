import { useState } from 'react'
import type { Applicant, CancelRegistrationResponse, CheckInResult } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { registrationPath } from './registration-api'
import { useStaffPost } from './useStaffPost'

const CANCEL_WARNING = '취소하면 이름·학번·휴대폰이 바로 지워지고 되돌릴 수 없어요.'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  attended: boolean
  onAttendance: (registrationId: string, attended: boolean) => void
  onCancelled: (registrationId: string) => void
}

// 이 신청자에게 보내는 쓰기 둘: 출석(취소)과 신청 취소.
function useApplicantPost({ councilId, applicant, onAttendance, onCancelled, ...handlers }: Props) {
  const post = useStaffPost(handlers)
  const base = registrationPath(councilId, applicant.id)
  async function setAttended(next: boolean) {
    const path = `${base}/${next ? 'attendance' : 'attendance/cancel'}`
    const result = await post.send<CheckInResult | CancelRegistrationResponse>(path)
    if (result.ok) onAttendance(applicant.id, next)
  }
  async function cancel() {
    const result = await post.send<CancelRegistrationResponse>(`${base}/cancel`)
    if (result.ok) onCancelled(applicant.id)
    return result.ok
  }
  return { post, setAttended, cancel }
}

// 신청자 한 줄의 [출석]·[출석 취소]·[신청 취소]. 신청 취소는 확인을 거친다. 오류는 버튼 아래(확인 중에는 확인 창)에 보인다.
export function ApplicantActions(props: Props) {
  const { applicant, attended } = props
  const [confirming, setConfirming] = useState(false)
  const { post, setAttended, cancel } = useApplicantPost(props)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={post.busy}
          onClick={() => void setAttended(!attended)}
        >
          {attended ? '출석 취소' : '출석'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={post.busy}
          onClick={() => setConfirming(true)}
        >
          신청 취소
        </Button>
      </div>
      {post.problem && !confirming && <StateMessage kind="error">{post.problem}</StateMessage>}
      <CancelDialog
        open={confirming}
        name={applicant.name}
        busy={post.busy}
        problem={post.problem}
        onConfirm={() => void cancel().then(ok => ok && setConfirming(false))}
        onCancel={() => {
          setConfirming(false)
          post.clear()
        }}
      />
    </>
  )
}

type DialogProps = {
  open: boolean
  name: string
  busy: boolean
  problem: string | null
  onConfirm: () => void
  onCancel: () => void
}

function CancelDialog({ name, problem, ...rest }: DialogProps) {
  return (
    <ConfirmDialog
      title={`${name}님의 신청을 취소할까요?`}
      description={CANCEL_WARNING}
      confirmLabel="신청 취소"
      destructive
      {...(problem ? { error: problem } : {})}
      {...rest}
    />
  )
}
