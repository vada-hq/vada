import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, type FieldErrors, type Parsed } from '@/lib/use-form-check'

type Props = {
  title: string
  description?: string
  // 칸 이름이자 비었을 때의 문구('○○ 사유를 입력해 주세요')에 쓴다.
  reasonLabel: string
  confirmLabel: string
  // 사유를 안 써도 되는 창(행사 완료). 아니면 꼭이다.
  optional?: boolean
  destructive?: boolean
  children?: ReactNode
  busy: boolean
  error: string | null
  // 기록마다 계약의 사유 검사를 넘긴다. 길이 숫자를 화면에 다시 적지 않는다.
  parse: (reason: string) => Parsed
  onClose: () => void
  onConfirm: (reason: string) => void
}

// 사유 한 칸을 받는 확인 창(지출·수입 취소, 결산 다시 열기, 행사 완료·완료 취소). 사유는 이력에 남는다.
export function CancelReasonDialog({
  reasonLabel,
  optional = false,
  parse,
  onConfirm,
  ...rest
}: Props) {
  const [reason, setReason] = useState('')
  const check = (): FieldErrors => ({
    reason: optional ? undefined : requiredText(reason, `${reasonLabel}를`),
  })
  return (
    <ConfirmDialog
      {...rest}
      unsaved={reason.trim() !== ''}
      check={check}
      parse={() => parse(reason)}
      onConfirm={() => onConfirm(reason)}
      field={errors => (
        <Field label={reasonLabel} required={!optional} optional={optional} error={errors.reason}>
          <Textarea
            value={reason}
            disabled={rest.busy}
            onChange={event => setReason(event.target.value)}
          />
        </Field>
      )}
    />
  )
}
