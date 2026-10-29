import type { ReactNode } from 'react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { collectsStudentId, type FormErrors, type FormValues } from './registration-form'

export type FieldsProps = {
  values: FormValues
  disabled: boolean
  onChange: (values: FormValues) => void
  // 만들기를 누른 뒤의 문제. 누르기 전에는 비어 있다.
  errors: FormErrors
}

type TextKey = 'name' | 'opensAt' | 'closesAt' | 'capacity' | 'fee' | 'payerFee' | 'nonPayerFee'

// 글 칸 하나. 숫자 칸은 숫자 자판(inputMode)을 띄운다. 값을 바꾸면 폼 값 전체를 새로 만들어 돌려준다.
function TextField({
  label,
  field,
  kind,
  optional,
  values,
  disabled,
  onChange,
  errors,
}: FieldsProps & {
  label: string
  field: TextKey
  kind: 'text' | 'number' | 'moment'
  optional?: boolean
}) {
  const typed =
    kind === 'moment'
      ? { type: 'datetime-local' }
      : kind === 'number'
        ? { inputMode: 'numeric' as const }
        : {}
  return (
    <Field
      label={label}
      optional={optional ?? false}
      required={!optional}
      error={(errors as Partial<Record<TextKey, string>>)[field]}
    >
      <Input
        {...typed}
        value={values[field]}
        disabled={disabled}
        onChange={event => onChange({ ...values, [field]: event.target.value })}
      />
    </Field>
  )
}

// 체크칸 하나. 잠긴 칸(locked)은 늘 받는 항목이다.
function CheckField({
  id,
  label,
  checked,
  locked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  locked?: boolean
  disabled: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <Label htmlFor={id} className="flex items-center gap-2 font-normal max-sm:min-h-11">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-primary-emphasis"
        checked={checked}
        disabled={disabled || locked}
        onChange={event => onChange?.(event.target.checked)}
      />
      {label}
    </Label>
  )
}

// 이름, 기간, 정원, 안내. 마감만 꼭 넣는다(계약에서 nullable이 아니다).
export function BasicFields(props: FieldsProps) {
  const { values, disabled, onChange } = props
  return (
    <>
      <TextField {...props} label="양식 이름" field="name" kind="text" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...props} label="신청 시작" field="opensAt" kind="moment" optional />
        <TextField {...props} label="신청 마감" field="closesAt" kind="moment" />
      </div>
      <TextField {...props} label="정원" field="capacity" kind="number" optional />
      <Field label="안내" optional error={props.errors.notice}>
        <Textarea
          rows={4}
          value={values.notice}
          disabled={disabled}
          onChange={event => onChange({ ...values, notice: event.target.value })}
        />
      </Field>
    </>
  )
}

// 참가비: 있는지 먼저 고르고, 있으면 금액과 납부자 별도 금액 여부를 받는다.
// 계좌 고르기(children)는 참가비가 있을 때 부모가 넘긴다.
export function FeeFields(props: FieldsProps & { children?: ReactNode }) {
  const { values, disabled, onChange, children } = props
  const charged = values.feeKind !== 'none'
  return (
    <>
      {/* relative: 숨긴 legend(absolute)가 화면 밖으로 나가 페이지 전체가 스크롤되지 않게 한다. */}
      <fieldset className="relative flex flex-col gap-2" disabled={disabled}>
        <legend className="sr-only">참가비</legend>
        {(['none', 'one'] as const).map(kind => (
          <div key={kind} className="flex items-center gap-2">
            <input
              id={`fee-${kind}`}
              type="radio"
              name="fee-kind"
              className="size-4 accent-primary-emphasis"
              checked={kind === 'none' ? !charged : charged}
              onChange={() => onChange({ ...values, feeKind: kind })}
            />
            <Label htmlFor={`fee-${kind}`} className="font-normal">
              {kind === 'none' ? '없음' : '있음'}
            </Label>
          </div>
        ))}
      </fieldset>
      {charged && (
        <CheckField
          id="fee-split"
          label="학생회비 납부자 별도 금액"
          checked={values.feeKind === 'split'}
          disabled={disabled}
          onChange={split => onChange({ ...values, feeKind: split ? 'split' : 'one' })}
        />
      )}
      {values.feeKind === 'one' && (
        <TextField {...props} label="참가비(원)" field="fee" kind="number" />
      )}
      {values.feeKind === 'split' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField {...props} label="납부자 참가비(원)" field="payerFee" kind="number" />
          <TextField {...props} label="미납자 참가비(원)" field="nonPayerFee" kind="number" />
        </div>
      )}
      {children}
    </>
  )
}

// 받는 항목. 이름은 늘 받고, 학번은 납부자 별도 금액이면 꼭 받는다(납부자 명단과 맞춘다, DEC-67).
export function CollectFields({ values, disabled, onChange }: FieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <CheckField id="collect-name" label="이름" checked locked disabled={disabled} />
      <CheckField
        id="collect-student-id"
        label="학번"
        checked={collectsStudentId(values)}
        locked={values.feeKind === 'split'}
        disabled={disabled}
        onChange={checked => onChange({ ...values, collectsStudentId: checked })}
      />
      <CheckField
        id="collect-phone"
        label="휴대폰 번호"
        checked={values.collectsPhone}
        disabled={disabled}
        onChange={checked => onChange({ ...values, collectsPhone: checked })}
      />
    </div>
  )
}
