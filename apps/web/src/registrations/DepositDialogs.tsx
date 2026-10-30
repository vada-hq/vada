import { useState } from 'react'
import { CancelDepositSchema, ConfirmDepositSchema, RefundSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { requiredText } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'
import { won } from '@/public/registration-text'

type Shared = {
  name: string
  busy: boolean
  error: string | null
  onClose: () => void
}

type ConfirmProps = Shared & {
  appliedFee: number
  onSubmit: (amount: number) => void
}

// 입금 확인: 금액은 적용 참가비로 채우고, 덜 내거나 더 낸 입금은 고쳐 적는다(DEC-68). 정산의 참가비 수입이 이 금액의 합이다.
// 참가비가 0원인 신청에는 서버가 이 동작을 주지 않아 열리지 않는다(RULE-44).
export function ConfirmDepositDialog({ name, appliedFee, onSubmit, ...shared }: ConfirmProps) {
  const [text, setText] = useState(String(appliedFee))
  const amount = wonOf(text)
  return (
    <ConfirmDialog
      {...shared}
      title={`${name}님의 입금을 확인할까요?`}
      confirmLabel="입금 확인"
      unsaved={text !== String(appliedFee)}
      check={() => ({
        amount:
          requiredText(text, '입금 금액을') ??
          (amount > 0 ? undefined : '1 이상의 숫자를 입력해 주세요'),
      })}
      parse={() => ConfirmDepositSchema.safeParse({ amount })}
      onConfirm={() => onSubmit(amount)}
      field={errors => (
        <Field
          label="입금 금액(원)"
          required
          hint={`적용 참가비 ${won(appliedFee)}`}
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
  const amount = wonOf(text)
  return (
    <ConfirmDialog
      {...shared}
      title={`${name}님에게 환불했나요?`}
      description="이름과 휴대폰 번호가 지워지고 되돌릴 수 없어요."
      confirmLabel="환불함"
      unsaved={text !== String(deposited)}
      check={() => ({
        amount:
          requiredText(text, '환불한 금액을') ??
          (amount > 0 && amount <= deposited
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
