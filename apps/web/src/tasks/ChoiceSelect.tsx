import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { choiceId, choiceValue, type Choice } from './task-form-options'

type Props = {
  label: string
  choices: Choice[]
  value: string | null
  disabled: boolean
  onChange: (id: string | null) => void
  autoFocus?: boolean
  // 비워 둬도 되는 선택칸이면 '(선택)'을, 꼭 골라야 하면 별표를 붙인다.
  optional?: boolean
  required?: boolean
  // 누를 때 확인해 찾은 문제
  error?: string | undefined
}

// 라벨이 붙은 선택칸. 선택지의 '없음'(null)은 빈 글 값으로 오간다.
export function ChoiceSelect(props: Props) {
  const { label, choices, value, disabled, onChange, autoFocus } = props
  const { optional = false, required = false, error } = props
  return (
    <Field label={label} optional={optional} required={required} error={error}>
      <NativeSelect
        value={choiceValue(value)}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={event => onChange(choiceId(event.target.value))}
      >
        {choices.map(item => (
          <option key={choiceValue(item.id)} value={choiceValue(item.id)}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}
