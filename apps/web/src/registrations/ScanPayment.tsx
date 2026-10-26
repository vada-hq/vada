import type { ApplicantChange } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import type { ScanOutcome } from './check-in'
import { DepositActions } from './DepositActions'
import { DEPOSIT_LABEL } from './registration-view'

type Props = EventDialogHandlers & {
  councilId: string
  outcome: Extract<ScanOutcome, { applicant: ApplicantChange }>
  onChange: (change: ApplicantChange) => void
  onGone: () => void
  onSaving: (saving: boolean) => void
  onReload?: () => void
}

// 출석과 입금은 별개다. 실제 입금을 확인한 운영진만 기록한다.
export function ScanPayment({ outcome, ...props }: Props) {
  const { appliedFee, applicant, name } = outcome
  if (appliedFee === undefined)
    return <p className="text-sm text-muted-foreground">참가비 확인 필요</p>
  if (appliedFee === 0) return <p className="text-sm text-muted-foreground">참가비 없음</p>
  const { status, amount } = applicant.deposit
  const pending = status === 'none'
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">참가비 {won(appliedFee)}</p>
      <div>
        <Badge tone={pending ? 'warning' : status === 'confirmed' ? 'success' : 'info'}>
          {pending ? '입금 확인 전' : DEPOSIT_LABEL[status]}
          {amount !== null && ` ${won(amount)}`}
        </Badge>
      </div>
      {pending && applicant.actions.includes('deposit.confirm') && (
        <p className="text-xs text-muted-foreground">실제 입금을 확인한 뒤 눌러 주세요.</p>
      )}
      <DepositActions {...props} applicant={{ ...applicant, name, appliedFee }} quickConfirm />
    </div>
  )
}
