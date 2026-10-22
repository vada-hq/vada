import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FormValues } from './registration-form'

type Props = {
  values: FormValues
  disabled: boolean
  onChange: (values: FormValues) => void
}

type TextKey = 'name' | 'opensAt' | 'closesAt' | 'capacity' | 'notice' | 'payerFee' | 'nonPayerFee'

// 라벨이 붙은 글 칸 하나. 값을 바꾸면 폼 값 전체를 새로 만들어 돌려준다.
function Field({
  label,
  field,
  type,
  multiline,
  values,
  disabled,
  onChange,
}: Props & { label: string; field: TextKey; type?: 'datetime-local'; multiline?: boolean }) {
  const shared = {
    value: values[field],
    disabled,
  }
  const change = (value: string) => onChange({ ...values, [field]: value })
  return (
    <Label className="flex flex-col gap-2">
      {label}
      {multiline ? (
        <Textarea rows={3} {...shared} onChange={event => change(event.target.value)} />
      ) : (
        <Input
          {...shared}
          {...(type ? { type } : { inputMode: 'numeric' as const })}
          onChange={event => change(event.target.value)}
        />
      )}
    </Label>
  )
}

// 양식 칸. 길이 상한과 시작·마감 순서, 참가비 짝은 계약이 판단하므로(safeParse) 여기에 적지 않는다.
export function FormFields(props: Props) {
  const { values, disabled, onChange } = props
  return (
    <>
      <NameField {...props} />
      <Field
        {...props}
        label="신청 시작 (비우면 바로 받아요)"
        field="opensAt"
        type="datetime-local"
      />
      <Field {...props} label="신청 마감" field="closesAt" type="datetime-local" />
      <Field {...props} label="정원 (비우면 제한 없어요)" field="capacity" />
      <Field {...props} label="안내 (문의할 곳을 적어 주세요)" field="notice" multiline />
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-blue-600"
          checked={values.collectsPhone}
          disabled={disabled}
          onChange={event => onChange({ ...values, collectsPhone: event.target.checked })}
        />
        휴대폰 번호도 받기
      </Label>
      <FeeFields {...props} />
    </>
  )
}

// 이름은 글 칸이지만 숫자 입력 모양(inputMode)을 주지 않는다.
function NameField({ values, disabled, onChange }: Props) {
  return (
    <Label className="flex flex-col gap-2">
      이름
      <Input
        value={values.name}
        disabled={disabled}
        onChange={event => onChange({ ...values, name: event.target.value })}
      />
    </Label>
  )
}

// 참가비는 둘 다 적거나 둘 다 비운다. 두 값이 다르면 학번을 받아 납부자를 가른다.
function FeeFields(props: Props) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={props.disabled}>
      <legend className="mb-2 text-xs font-medium text-gray-700">
        참가비(원) · 둘 다 비우면 참가비가 없어요
      </legend>
      <Field {...props} label="납부자 참가비" field="payerFee" />
      <Field {...props} label="미납자 참가비" field="nonPayerFee" />
      <p className="text-xs text-gray-500">
        두 값이 다르면 학생이 학번을 내고, 학생회비 납부자 명단과 맞춰 참가비가 정해져요.
      </p>
    </fieldset>
  )
}
