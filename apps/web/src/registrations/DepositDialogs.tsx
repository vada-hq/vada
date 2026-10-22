import { useState, type ReactNode } from 'react'
import { CancelDepositSchema, RefundSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { won } from '@/public/registration-text'

type Shared = {
  name: string
  busy: boolean
  error: string | null
  onClose: () => void
}

type FrameProps = Omit<Shared, 'name'> & {
  title: string
  description: string
  submitLabel: string
  valid: boolean
  onSubmit: () => void
  children: ReactNode
}

// 사유나 금액 한 칸을 받는 확인 창. 보내는 동안에는 닫지 않고 버튼을 막는다.
function Frame({
  title,
  description,
  submitLabel,
  valid,
  onSubmit,
  children,
  ...shared
}: FrameProps) {
  const { busy, error, onClose } = shared
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
        </DialogHeader>
        {children}
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button disabled={!valid || busy} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ReasonProps = Shared & { refund: boolean; onSubmit: (reason: string) => void }

// 입금 확인 취소: 사유를 받아 이력에 남긴다. 환불 대기 신청이면 이름·휴대폰도 함께 지워진다.
export function CancelDepositDialog({ name, refund, onSubmit, ...shared }: ReasonProps) {
  const [reason, setReason] = useState('')
  const valid = CancelDepositSchema.safeParse({ reason }).success
  const warning = refund
    ? ' 환불 대기 신청이라 이름과 휴대폰 번호도 함께 지워지고 되돌릴 수 없어요.'
    : ''
  return (
    <Frame
      title={`${name}님의 입금 확인을 취소할까요?`}
      description={`입금하지 않은 것으로 돌려요. 사유는 이력에 남아요.${warning}`}
      submitLabel="확인 취소"
      valid={valid}
      onSubmit={() => onSubmit(reason)}
      {...shared}
    >
      <Label className="flex flex-col gap-2">
        취소 사유
        <Textarea
          value={reason}
          disabled={shared.busy}
          onChange={event => setReason(event.target.value)}
        />
      </Label>
    </Frame>
  )
}

type RefundProps = Shared & { deposited: number; onSubmit: (amount: number) => void }

// 환불함: 밖에서 돌려준 금액을 표시한다(VADA는 돈을 옮기지 않는다). 이름·휴대폰 번호를 지워 되돌릴 수 없다.
export function RefundDialog({ name, deposited, onSubmit, ...shared }: RefundProps) {
  const [text, setText] = useState(String(deposited))
  const amount = text.trim() === '' ? Number.NaN : Number(text)
  const valid = RefundSchema.safeParse({ amount }).success && amount <= deposited
  return (
    <Frame
      title={`${name}님에게 환불했나요?`}
      description={`통장에서 돌려준 뒤에 눌러 주세요. 이름과 휴대폰 번호가 지워지고 되돌릴 수 없어요. 입금액은 ${won(deposited)}이에요.`}
      submitLabel="환불함"
      valid={valid}
      onSubmit={() => onSubmit(amount)}
      {...shared}
    >
      <Label className="flex flex-col gap-2">
        환불한 금액(원)
        <Input
          inputMode="numeric"
          value={text}
          disabled={shared.busy}
          onChange={event => setText(event.target.value)}
        />
      </Label>
    </Frame>
  )
}
