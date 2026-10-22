import { useState } from 'react'
import {
  statusOf,
  type Applicant,
  type ApplicantDeposit,
  type DepositResponse,
} from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import { CancelDepositDialog, RefundDialog } from './DepositDialogs'
import { registrationPath } from './registration-api'
import type { StaffCan } from './registration-view'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: Applicant
  can: StaffCan
  // 서버가 돌려준 입금 상태. 환불함이면 이름이 비어 줄이 빠진다(부모가 정한다).
  onDeposit: (registrationId: string, deposit: ApplicantDeposit) => void
}

type Step = 'confirm' | 'cancel' | 'refund' | null

// 입금 쓰기 셋. 404·403은 useStaffPost가 부모에게 알려 닫고, 그 밖의 실패는 창 안(없으면 버튼 아래)에 보인다.
function useDepositPost({ councilId, applicant, onDeposit, ...handlers }: Props) {
  const post = useStaffPost(handlers)
  const [step, setStep] = useState<Step>(null)
  const path = (tail: string) => `${registrationPath(councilId, applicant.id)}/${tail}`
  async function run(tail: string, body: unknown) {
    const result = await post.send<DepositResponse>(path(tail), body)
    if (result.ok) {
      onDeposit(applicant.id, result.data.deposit)
      return setStep(null)
    }
    // 대상이 없어졌거나(404) 권한을 잃었으면(403) 부모가 이유를 보이므로 창만 닫는다.
    if (result.status === statusOf('NOT_FOUND') || result.status === statusOf('FORBIDDEN'))
      setStep(null)
  }
  const open = (next: Step) => {
    post.clear()
    setStep(next)
  }
  return { post, step, open, run }
}

// 신청자 한 줄의 [입금 확인]·[확인 취소]·[환불함]. 보이는 조건은 서버가 준 동작과 입금 상태다. 확인을 거쳐 보낸다.
export function DepositActions(props: Props) {
  const { applicant, can } = props
  const { post, step, open, run } = useDepositPost(props)
  const { status, amount } = applicant.deposit
  const canConfirm =
    can.deposit && status === 'none' && !applicant.cancelled && applicant.appliedFee > 0
  const canUndo = can.deposit && (status === 'confirmed' || status === 'refund_pending')
  const canRefund = can.refund && status === 'refund_pending' && amount !== null
  if (!canConfirm && !canUndo && !canRefund) return null
  const shared = {
    name: applicant.name,
    busy: post.busy,
    error: post.problem,
    onClose: () => open(null),
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canConfirm && (
          <Button size="sm" disabled={post.busy} onClick={() => open('confirm')}>
            입금 확인
          </Button>
        )}
        {canUndo && (
          <Button variant="outline" size="sm" disabled={post.busy} onClick={() => open('cancel')}>
            확인 취소
          </Button>
        )}
        {canRefund && (
          <Button variant="outline" size="sm" disabled={post.busy} onClick={() => open('refund')}>
            환불함
          </Button>
        )}
      </div>
      {post.problem && step === null && <StateMessage kind="error">{post.problem}</StateMessage>}
      <ConfirmDialog
        open={step === 'confirm' && canConfirm}
        title={`${applicant.name}님의 입금을 확인할까요?`}
        description={`${won(applicant.appliedFee)}이 통장에 들어온 것을 확인한 뒤에 눌러 주세요. VADA는 돈을 옮기지 않고 표시만 해요.`}
        confirmLabel="입금 확인"
        busy={post.busy}
        {...(post.problem ? { error: post.problem } : {})}
        onConfirm={() => void run('deposit', { amount: applicant.appliedFee })}
        onCancel={() => open(null)}
      />
      {step === 'cancel' && canUndo && (
        <CancelDepositDialog
          refund={status === 'refund_pending'}
          onSubmit={reason => void run('deposit/cancel', { reason })}
          {...shared}
        />
      )}
      {step === 'refund' && canRefund && amount !== null && (
        <RefundDialog
          deposited={amount}
          onSubmit={refunded => void run('refund', { amount: refunded })}
          {...shared}
        />
      )}
    </>
  )
}
