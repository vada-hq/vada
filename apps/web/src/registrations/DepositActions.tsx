import { useState } from 'react'
import {
  statusOf,
  type Applicant,
  type ApplicantAction,
  type ApplicantChange,
  type StaffDepositResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { REGISTRATION_ACTION_GONE } from '@/lib/registration-messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { CancelDepositDialog, ConfirmDepositDialog, RefundDialog } from './DepositDialogs'
import { registrationPath } from './registration-api'
import { useStaffPost } from './useStaffPost'

type DepositApplicant = Pick<Applicant, 'id' | 'name' | 'appliedFee' | 'deposit' | 'actions'>

type Props = EventDialogHandlers & {
  councilId: string
  applicant: DepositApplicant
  // 스캐너 카드처럼 휴대폰에서 손가락으로 누르는 곳이면 버튼을 44px로 키운다.
  touch?: boolean
  onSaving?: (saving: boolean) => void
  onReload?: () => void
  // 서버가 돌려준 줄의 새 모습. 환불함이면 이름이 비어 줄이 빠진다(부모가 정한다).
  onChange: (change: ApplicantChange) => void
  // 신청이 없어졌다(404). 줄을 뺀다.
  onGone: () => void
}

type Step = 'confirm' | 'cancel' | 'refund' | null

// 입금 쓰기 셋. 404·403은 useStaffPost가 부모에게 알려 닫고, 그 밖의 실패는 창 안(없으면 버튼 아래)에 보인다.
function useDepositPost({ councilId, applicant, onChange, onGone, onSaving, ...handlers }: Props) {
  const post = useStaffPost(handlers, onSaving, applicant.actions)
  const [step, setStep] = useState<Step>(null)
  const path = (tail: string) => `${registrationPath(councilId, applicant.id)}/${tail}`
  async function run(tail: string, body: unknown) {
    const result = await post.send<StaffDepositResponse>(path(tail), body)
    if (result.ok) {
      onChange(result.data.applicant)
      return setStep(null)
    }
    // 대상이 없어졌거나(404) 권한을 잃었으면(403) 부모가 이유를 보이므로 창만 닫는다.
    if (result.status === statusOf('NOT_FOUND')) onGone()
    if (result.status === statusOf('NOT_FOUND') || result.status === statusOf('FORBIDDEN'))
      setStep(null)
  }
  const open = (next: Step) => {
    post.clear()
    setStep(next)
  }
  return { post, step, setStep, open, run }
}

type Allowed = { confirm: boolean; undo: boolean; refund: boolean }

// 보이는 조건은 서버가 그 줄에 준 동작(applicant.actions)뿐이다. 참가비가 없는 신청, 취소한 신청, 완료한 행사의 줄은 서버가 주지 않는다.
function allowedOf({ applicant }: Pick<Props, 'applicant'>): Allowed {
  const has = (action: ApplicantAction) => applicant.actions.includes(action)
  return {
    confirm: has('deposit.confirm'),
    undo: has('deposit.cancel'),
    refund: has('deposit.refund'),
  }
}

// 열린 확인 창의 동작이 줄에서 사라졌는가.
const STEP_ACTION = { confirm: 'confirm', cancel: 'undo', refund: 'refund' } as const

type Open = (next: Step) => void

function DepositButtons({
  allowed,
  busy,
  touch,
  open,
}: {
  allowed: Allowed
  busy: boolean
  touch: boolean
  open: Open
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.confirm && (
        <Button size="sm" touch={touch} busy={busy} onClick={() => open('confirm')}>
          입금 확인
        </Button>
      )}
      {allowed.undo && (
        <Button
          variant="outline"
          size="sm"
          touch={touch}
          busy={busy}
          onClick={() => open('cancel')}
        >
          확인 취소
        </Button>
      )}
      {allowed.refund && (
        <Button
          variant="outline"
          size="sm"
          touch={touch}
          busy={busy}
          onClick={() => open('refund')}
        >
          환불함
        </Button>
      )}
    </div>
  )
}

type StepsProps = {
  applicant: DepositApplicant
  allowed: Allowed
  step: Step
  post: ReturnType<typeof useStaffPost>
  open: Open
  run: (tail: string, body: unknown) => Promise<void>
}

// 열린 확인 창 하나. 권한이나 입금 상태가 바뀌어 동작이 사라졌으면 열지 않는다.
function DepositSteps({ applicant, allowed, step, post, open, run }: StepsProps) {
  const { status, amount } = applicant.deposit
  const shared = {
    name: applicant.name,
    busy: post.busy,
    error: post.problem,
    onClose: () => open(null),
  }
  return (
    <>
      {step === 'confirm' && allowed.confirm && (
        <ConfirmDepositDialog
          appliedFee={applicant.appliedFee}
          onSubmit={amount => void run('deposit', { amount })}
          {...shared}
        />
      )}
      {step === 'cancel' && allowed.undo && (
        <CancelDepositDialog
          refund={status === 'refund_pending'}
          onSubmit={reason => void run('deposit/cancel', { reason })}
          {...shared}
        />
      )}
      {step === 'refund' && allowed.refund && amount !== null && (
        <RefundDialog
          deposited={amount}
          onSubmit={refunded => void run('refund', { amount: refunded })}
          {...shared}
        />
      )}
    </>
  )
}

// 신청자 한 줄의 [입금 확인]·[확인 취소]·[환불함]. 확인을 거쳐 보낸다.
function DepositProblem({
  post,
  step,
  onReload,
}: {
  post: ReturnType<typeof useStaffPost>
  step: Step
  onReload: Props['onReload']
}) {
  if (!post.problem || step !== null) return null
  return (
    <>
      <StateMessage kind="error">{post.problem}</StateMessage>
      {onReload && (
        <Button variant="outline" touch busy={post.busy} onClick={onReload}>
          새로 읽기
        </Button>
      )}
    </>
  )
}

export function DepositActions(props: Props) {
  const { post, step, setStep, open, run } = useDepositPost(props)
  const [gone, setGone] = useState<string | null>(null)
  const allowed = allowedOf(props)
  const lost = step !== null && !allowed[STEP_ACTION[step]]
  useDialogGuard(step !== null, lost ? REGISTRATION_ACTION_GONE : null, message => {
    setStep(null)
    setGone(message)
  })
  if (!allowed.confirm && !allowed.undo && !allowed.refund && !gone) return null
  const openStep: Open = next => {
    setGone(null)
    open(next)
  }
  return (
    <>
      {gone && <StateMessage kind="error">{gone}</StateMessage>}
      <DepositButtons
        allowed={allowed}
        busy={post.busy}
        touch={props.touch ?? false}
        open={openStep}
      />
      <DepositProblem post={post} step={step} onReload={props.onReload} />
      <DepositSteps
        applicant={props.applicant}
        allowed={allowed}
        step={step}
        post={post}
        open={openStep}
        run={run}
      />
    </>
  )
}
