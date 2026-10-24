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
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck } from '@/lib/use-form-check'
import { won } from '@/public/registration-text'

type Shared = {
  name: string
  busy: boolean
  error: string | null
  onClose: () => void
}

type FrameProps = Omit<Shared, 'name'> & {
  title: string
  // 되돌릴 수 없는 결과만 적는다. 없으면 두지 않는다.
  description?: string | undefined
  submitLabel: string
  check: ReturnType<typeof useFormCheck<HTMLDivElement>>
  // 계약까지 맞는지(맞지 않으면 누르지 않은 것처럼 둔다).
  valid: boolean
  onSubmit: () => void
  children: ReactNode
}

// 사유나 금액 한 칸을 받는 확인 창. 버튼은 끄지 않고 누를 때 확인한다. 보내는 동안에는 닫지 않고 버튼을 막는다.
function Frame({
  title,
  description,
  submitLabel,
  check,
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
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          {description && (
            <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
          )}
        </DialogHeader>
        <div ref={check.formRef} className="flex flex-col gap-4">
          {children}
        </div>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button disabled={busy} onClick={() => check.attempt() && valid && onSubmit()}>
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
  const check = useFormCheck<HTMLDivElement>(() => ({
    reason: requiredText(reason, '취소 사유를'),
  }))
  return (
    <Frame
      title={`${name}님의 입금 확인을 취소할까요?`}
      description={
        refund ? '환불 대기 신청이라 이름과 휴대폰 번호도 지워지고 되돌릴 수 없어요.' : undefined
      }
      submitLabel="확인 취소"
      check={check}
      valid={valid}
      onSubmit={() => onSubmit(reason)}
      {...shared}
    >
      <Field label="취소 사유" required error={check.errors.reason}>
        <Textarea
          value={reason}
          disabled={shared.busy}
          onChange={event => setReason(event.target.value)}
        />
      </Field>
    </Frame>
  )
}

type RefundProps = Shared & { deposited: number; onSubmit: (amount: number) => void }

// 환불함: 밖에서 돌려준 금액을 표시한다(VADA는 돈을 옮기지 않는다). 이름·휴대폰 번호를 지워 되돌릴 수 없다.
export function RefundDialog({ name, deposited, onSubmit, ...shared }: RefundProps) {
  const [text, setText] = useState(String(deposited))
  const amount = text.trim() === '' ? Number.NaN : Number(text)
  const valid = RefundSchema.safeParse({ amount }).success && amount <= deposited
  const check = useFormCheck<HTMLDivElement>(() => ({
    amount:
      requiredText(text, '환불한 금액을') ??
      (Number.isInteger(amount) && amount > 0 && amount <= deposited
        ? undefined
        : `1원부터 ${won(deposited)} 사이로 입력해 주세요`),
  }))
  return (
    <Frame
      title={`${name}님에게 환불했나요?`}
      description="이름과 휴대폰 번호가 지워지고 되돌릴 수 없어요."
      submitLabel="환불함"
      check={check}
      valid={valid}
      onSubmit={() => onSubmit(amount)}
      {...shared}
    >
      <Field
        label="환불한 금액(원)"
        required
        hint={`입금액 ${won(deposited)}`}
        error={check.errors.amount}
      >
        <Input
          inputMode="numeric"
          value={text}
          disabled={shared.busy}
          onChange={event => setText(event.target.value)}
        />
      </Field>
    </Frame>
  )
}
