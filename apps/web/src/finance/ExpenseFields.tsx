import { useId, type Dispatch, type SetStateAction } from 'react'
import { EXPENSE_METHODS } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { FieldErrors } from '@/lib/use-form-check'
import type { ExpenseMode, ExpenseValues } from './expense-form'
import { METHOD_LABEL } from './expense-view'

const MODE_LABEL: Record<ExpenseMode, string> = {
  request: '요청한 품목 결제',
  direct: '요청 없이',
}

export function ModeToggle({
  mode,
  disabled,
  onMode,
}: {
  mode: ExpenseMode
  disabled: boolean
  onMode: (mode: ExpenseMode) => void
}) {
  return (
    <div role="group" aria-label="지출 방식" className="flex flex-wrap gap-2">
      {(Object.keys(MODE_LABEL) as ExpenseMode[]).map(item => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={mode === item ? 'secondary' : 'outline'}
          aria-pressed={mode === item}
          busy={disabled}
          onClick={() => item !== mode && onMode(item)}
        >
          {MODE_LABEL[item]}
        </Button>
      ))}
    </div>
  )
}

export type FieldsProps = {
  values: ExpenseValues
  disabled: boolean
  today: string
  onChange: Dispatch<SetStateAction<ExpenseValues>>
  errors: FieldErrors
}

// 사용처와 내역(위쪽 두 칸).
export function NameFields({ values, disabled, onChange, errors }: Omit<FieldsProps, 'today'>) {
  return (
    <>
      <Field label="사용처" required error={errors.vendor}>
        <Input
          value={values.vendor}
          disabled={disabled}
          onChange={event => onChange({ ...values, vendor: event.target.value })}
        />
      </Field>
      <Field label="내역" required error={errors.description}>
        <Input
          value={values.description}
          disabled={disabled}
          onChange={event => onChange({ ...values, description: event.target.value })}
        />
      </Field>
    </>
  )
}

// 결제일은 미래 날짜를 막고, 결제 수단은 직접 고르게 한다(DEC-92).
export function PaymentFields({
  values,
  disabled,
  today,
  onChange,
  errors,
  paidOnNotice,
}: FieldsProps & {
  paidOnNotice?: string | undefined
}) {
  const noticeId = useId()
  return (
    <>
      <div className="flex flex-col gap-2">
        <Field label="결제일" required error={errors.paidOn}>
          <Input
            type="date"
            className="max-sm:min-h-11"
            max={today}
            value={values.paidOn}
            disabled={disabled}
            aria-describedby={paidOnNotice ? noticeId : undefined}
            onChange={event => onChange({ ...values, paidOn: event.target.value })}
          />
        </Field>
        {paidOnNotice && (
          <p id={noticeId} role="status" className="text-xs break-keep text-attention">
            {paidOnNotice}
          </p>
        )}
      </div>
      <Field label="결제 수단" required error={errors.method}>
        <NativeSelect
          className="max-sm:min-h-11"
          value={values.method}
          disabled={disabled}
          onChange={event =>
            onChange({ ...values, method: event.target.value as ExpenseValues['method'] })
          }
        >
          <option value="">선택</option>
          {EXPENSE_METHODS.map(method => (
            <option key={method} value={method}>
              {METHOD_LABEL[method]}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  )
}
