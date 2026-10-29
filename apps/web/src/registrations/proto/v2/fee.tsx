import { useId } from 'react'
import type { FieldErrors } from '@/lib/use-form-check'
import type { FormValues } from '../../registration-form'
import { ErrorLine, invalid } from './parts'
import { size, type } from './tokens'

// 참가비 값 자리: 없음/있음 세로 라디오 → 금액(납부자 금액 다름 체크 → 두 금액).

type Change = (patch: Partial<FormValues>, key?: string) => void

function Amount({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string | undefined
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2">
        <span className="min-w-12 text-fg-muted">{label}</span>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          {...invalid(id, error)}
          onChange={event => onChange(event.target.value)}
          className={`${size.amount} ${size.row} rounded-lg bg-surface-muted px-3 text-right ${type.body} text-fg-body outline-none focus:bg-white focus:ring-2 focus:ring-primary-emphasis aria-invalid:ring-2 aria-invalid:ring-danger-emphasis`}
        />
        <span className="text-fg-body">원</span>
      </label>
      <ErrorLine id={`${id}-error`} error={error} />
    </div>
  )
}

const CHOICE_LABEL = `flex ${size.row} cursor-pointer items-center gap-2.5 self-start pr-2`

// 참가비: 없음/있음 세로 라디오, 있으면 금액(납부자 금액 다름 체크 → 두 금액). 펼치는 라디오는 세로(AGENTS '화면 문구와 폼').
export function FeeValue({
  values,
  errors,
  onChange,
}: {
  values: FormValues
  errors: FieldErrors
  onChange: Change
}) {
  const name = useId()
  const on = values.feeKind !== 'none'
  return (
    <fieldset className="flex flex-col py-1">
      <legend className="sr-only">참가비</legend>
      {(['none', 'one'] as const).map(kind => (
        <label key={kind} className={CHOICE_LABEL}>
          <input
            type="radio"
            name={name}
            checked={kind === 'none' ? !on : on}
            onChange={() => onChange({ feeKind: kind }, 'fee')}
            className="size-4 accent-primary-emphasis"
          />
          {kind === 'none' ? '없음' : '있음'}
        </label>
      ))}
      {on && (
        <div className="ml-6.5 flex flex-col gap-2 pt-1">
          {values.feeKind === 'one' ? (
            <Amount
              label="참가비"
              value={values.fee}
              error={errors.fee}
              onChange={fee => onChange({ fee }, 'fee')}
            />
          ) : (
            <>
              <Amount
                label="납부자"
                value={values.payerFee}
                error={errors.payerFee}
                onChange={payerFee => onChange({ payerFee }, 'payerFee')}
              />
              <Amount
                label="미납자"
                value={values.nonPayerFee}
                error={errors.nonPayerFee}
                onChange={nonPayerFee => onChange({ nonPayerFee }, 'nonPayerFee')}
              />
            </>
          )}
          <label className={CHOICE_LABEL}>
            <input
              type="checkbox"
              checked={values.feeKind === 'split'}
              onChange={event => onChange({ feeKind: event.target.checked ? 'split' : 'one' })}
              className="size-4 accent-primary-emphasis"
            />
            학생회비 납부자 금액 다름
          </label>
        </div>
      )}
    </fieldset>
  )
}
