import { useState } from 'react'
import { CancelDepositSchema, RefundSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { requiredText } from '@/lib/use-form-check'
import { won } from '@/public/registration-text'

type Shared = {
  name: string
  busy: boolean
  error: string | null
  onClose: () => void
}

type ReasonProps = Shared & { refund: boolean; onSubmit: (reason: string) => void }

// 입금 확인 취소: 사유를 받아 이력에 남긴다. 환불 대기 신청이면 이름·휴대폰도 함께 지워진다.
export function CancelDepositDialog({ name, refund, onSubmit, ...shared }: ReasonProps) {
  return (
    <CancelReasonDialog
      {...shared}
      title={`${name}님의 입금 확인을 취소할까요?`}
      {...(refund
        ? { description: '환불 대기 신청이라 이름과 휴대폰 번호도 지워지고 되돌릴 수 없어요.' }
        : {})}
      reasonLabel="취소 사유"
      confirmLabel="입금 확인 취소"
      destructive
      parse={reason => CancelDepositSchema.safeParse({ reason })}
      onConfirm={onSubmit}
    />
  )
}

type RefundProps = Shared & { deposited: number; onSubmit: (amount: number) => void }

// 환불함: 밖에서 돌려준 금액을 표시한다(VADA는 돈을 옮기지 않는다). 이름·휴대폰 번호를 지워 되돌릴 수 없다.
export function RefundDialog({ name, deposited, onSubmit, ...shared }: RefundProps) {
  const [text, setText] = useState(String(deposited))
  const amount = text.trim() === '' ? Number.NaN : Number(text)
  return (
    <ConfirmDialog
      {...shared}
      title={`${name}님에게 환불했나요?`}
      description="이름과 휴대폰 번호가 지워지고 되돌릴 수 없어요."
      confirmLabel="환불함"
      check={() => ({
        amount:
          requiredText(text, '환불한 금액을') ??
          (Number.isInteger(amount) && amount > 0 && amount <= deposited
            ? undefined
            : `1원부터 ${won(deposited)} 사이로 입력해 주세요`),
      })}
      parse={() => RefundSchema.safeParse({ amount })}
      onConfirm={() => onSubmit(amount)}
      field={errors => (
        <Field
          label="환불한 금액(원)"
          required
          hint={`입금액 ${won(deposited)}`}
          error={errors.amount}
        >
          <Input
            inputMode="numeric"
            value={text}
            disabled={shared.busy}
            onChange={event => setText(event.target.value)}
          />
        </Field>
      )}
    />
  )
}
