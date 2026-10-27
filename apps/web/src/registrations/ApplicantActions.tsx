import { useState } from 'react'
import {
  statusOf,
  type Applicant,
  type ApplicantChange,
  type CheckInResult,
  type StaffCancelResponse,
} from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { REGISTRATION_ACTION_GONE } from '@/lib/registration-messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { registrationPath } from './registration-api'
import { useStaffPost, type StaffPostResult } from './useStaffPost'

const CANCEL_WARNING = '취소하면 이름·학번·휴대폰이 바로 지워지고 되돌릴 수 없어요.'
// 입금을 확인한 신청은 환불 연락을 위해 이름과 휴대폰 번호를 환불할 때까지 남긴다(DEC-55).
const CANCEL_WARNING_DEPOSITED =
  '취소하면 학번이 바로 지워지고 되돌릴 수 없어요. 이름과 휴대폰 번호는 환불을 표시할 때까지 남고, 신청은 “환불 대기”로 바뀌어요.'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  onChange: (change: ApplicantChange) => void
  onGone: () => void
}

// 이 신청자에게 보내는 쓰기 둘: 출석(취소)과 신청 취소. 404면 신청이 이미 없어졌으니 목록에서 뺀다(이유는 useStaffPost가 부모에게 알린다).
function useApplicantPost({ councilId, applicant, onChange, onGone, ...handlers }: Props) {
  const post = useStaffPost(handlers, undefined, applicant.actions)
  const base = registrationPath(councilId, applicant.id)
  const isGone = (result: StaffPostResult<unknown>) =>
    !result.ok && result.status === statusOf('NOT_FOUND')
  async function setAttended(next: boolean) {
    const path = `${base}/${next ? 'attendance' : 'attendance/cancel'}`
    const result = await post.send<StaffCancelResponse | CheckInResult>(path)
    if (result.ok) onChange(result.data.applicant)
    else if (isGone(result)) onGone()
  }
  // 확인 창을 닫아도 되는가: 취소했거나, 신청이 없어졌거나(404), 권한을 잃었다(403). 닫는 이유는 부모가 보인다.
  async function cancel() {
    const result = await post.send<StaffCancelResponse>(`${base}/cancel`)
    if (result.ok) onChange(result.data.applicant)
    else if (isGone(result)) onGone()
    return (
      result.ok ||
      result.status === statusOf('NOT_FOUND') ||
      result.status === statusOf('FORBIDDEN')
    )
  }
  return { post, setAttended, cancel }
}

type ButtonsProps = {
  applicant: Applicant
  attended: boolean
  busy: boolean
  onToggle: () => void
  onCancel: () => void
}

// 그 줄의 actions에 있는 버튼만 보인다.
function ActionButtons({ applicant, attended, busy, onToggle, onCancel }: ButtonsProps) {
  const toggle = attended ? 'registration.cancel_check_in' : 'registration.check_in'
  return (
    <div className="flex flex-wrap gap-2">
      {applicant.actions.includes(toggle) && (
        <Button variant="outline" size="sm" touch busy={busy} onClick={onToggle}>
          {attended ? '출석 취소' : '출석'}
        </Button>
      )}
      {applicant.actions.includes('registration.cancel') && (
        <Button variant="outline" size="sm" touch busy={busy} onClick={onCancel}>
          신청 취소
        </Button>
      )}
    </div>
  )
}

// 신청자 한 줄의 [출석]·[출석 취소]·[신청 취소]. 버튼은 그 줄의 actions에 있는 것만 보인다.
// 신청 취소는 확인을 거친다. 확인 창이 열린 동안 그 동작이 사라지면 닫고 이유를 보인다. 오류는 버튼 아래(확인 중에는 확인 창)에 보인다.
export function ApplicantActions(props: Props) {
  const { applicant } = props
  const { attended } = applicant
  const [confirming, setConfirming] = useState(false)
  const [gone, setGone] = useState<string | null>(null)
  const { post, setAttended, cancel } = useApplicantPost({
    ...props,
    onChange: change => {
      setConfirming(false)
      props.onChange(change)
    },
  })
  const canCancel = applicant.actions.includes('registration.cancel')
  useDialogGuard(confirming, canCancel ? null : REGISTRATION_ACTION_GONE, message => {
    setConfirming(false)
    setGone(message)
  })
  const mine = applicant.actions.some(action => action.startsWith('registration.'))
  if (!mine && !gone) return null

  return (
    <>
      <ActionButtons
        applicant={applicant}
        attended={attended}
        busy={post.busy}
        onToggle={() => {
          setGone(null)
          void setAttended(!attended)
        }}
        onCancel={() => {
          setGone(null)
          setConfirming(true)
        }}
      />
      {gone && <StateMessage kind="error">{gone}</StateMessage>}
      {post.problem && !confirming && <StateMessage kind="error">{post.problem}</StateMessage>}
      <CancelDialog
        open={confirming}
        name={applicant.name}
        deposited={applicant.deposit.status === 'confirmed'}
        busy={post.busy}
        problem={post.problem}
        onConfirm={() => void cancel().then(ok => ok && setConfirming(false))}
        onClose={() => {
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
  deposited: boolean
  busy: boolean
  problem: string | null
  onConfirm: () => void
  onClose: () => void
}

function CancelDialog({ name, deposited, problem, ...rest }: DialogProps) {
  return (
    <ConfirmDialog
      title={`${name}님의 신청을 취소할까요?`}
      description={deposited ? CANCEL_WARNING_DEPOSITED : CANCEL_WARNING}
      confirmLabel="신청 취소"
      destructive
      {...(problem ? { error: problem } : {})}
      {...rest}
    />
  )
}
