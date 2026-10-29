import { useId } from 'react'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import { ErrorLine, invalid } from './DocParts'
import { fieldSurface, size, type } from './doc-look'
import type { Change, FieldIds } from './FormSettings'
import type { FormValues } from './registration-form'

// 참가비 값 자리: 없음/있음 세로 라디오 → 있으면 금액, '학생회비 납부자 금액 다름' 체크 → 납부자·미납자 두 금액.
// 펼치는 라디오는 세로로 둔다(AGENTS '화면 문구와 폼'). 납부자 금액이 다르면 학생이 학번을 낸다(DEC-67).

function Amount({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="min-w-12 text-fg-muted">
          {label}
        </label>
        <span className="relative inline-flex items-center gap-1">
          <Input
            id={id}
            inputMode="numeric"
            value={value}
            aria-required
            {...invalid(id, error)}
            onChange={event => onChange(event.target.value)}
            className={`peer min-w-9 pointer-coarse:min-w-11 field-sizing-content ${value ? 'w-auto' : 'w-24'} ${size.row} px-2.5 py-1.5 ${type.input} ${fieldSurface}`}
          />
          {value ? (
            <span className="text-fg-body">원</span>
          ) : (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-2.5 flex items-center ${type.input} text-fg-tertiary peer-focus:hidden`}
            >
              비어 있음
            </span>
          )}
        </span>
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </div>
  )
}

const CHOICE = `flex ${size.row} cursor-pointer items-center gap-2.5 self-start pr-2`

export function FeeValue({
  ids,
  values,
  errors,
  onChange,
}: {
  ids: FieldIds
  values: FormValues
  errors: FieldErrors
  onChange: Change
}) {
  const name = useId()
  const charged = values.feeKind !== 'none'
  return (
    // relative: 숨긴 legend(absolute)가 화면 밖으로 나가 페이지 전체가 스크롤되지 않게 한다.
    <fieldset className="relative flex flex-col py-1 pl-2.5">
      <legend className="sr-only">참가비</legend>
      {(['none', 'one'] as const).map(kind => (
        <label key={kind} className={CHOICE}>
          <input
            type="radio"
            name={name}
            checked={kind === 'none' ? !charged : charged}
            onChange={() => onChange({ feeKind: kind })}
            className="size-4 accent-primary-emphasis"
          />
          {kind === 'none' ? '없음' : '있음'}
        </label>
      ))}
      {charged && (
        <div className="ml-6.5 flex flex-col gap-2 pt-1">
          {values.feeKind === 'one' ? (
            <Amount
              id={ids.fee}
              label="참가비"
              value={values.fee}
              error={errors.fee}
              onChange={fee => onChange({ fee })}
            />
          ) : (
            <>
              <Amount
                id={ids.payerFee}
                label="납부자"
                value={values.payerFee}
                error={errors.payerFee}
                onChange={payerFee => onChange({ payerFee })}
              />
              <Amount
                id={ids.nonPayerFee}
                label="미납자"
                value={values.nonPayerFee}
                error={errors.nonPayerFee}
                onChange={nonPayerFee => onChange({ nonPayerFee })}
              />
            </>
          )}
          <label className={CHOICE}>
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
