import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { choiceId, choiceValue, type Choice } from './task-form-options'

type Props = {
  label: string
  choices: Choice[]
  value: string | null
  disabled: boolean
  onChange: (id: string | null) => void
  autoFocus?: boolean
}

// 라벨이 붙은 선택칸. 선택지의 '없음'(null)은 빈 글 값으로 오간다.
export function ChoiceSelect({ label, choices, value, disabled, onChange, autoFocus }: Props) {
  return (
    <Label className="flex flex-col gap-2">
      {label}
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
    </Label>
  )
}
