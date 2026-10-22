import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { TaskFieldValues } from './task-fields'

type Props = {
  values: TaskFieldValues
  disabled: boolean
  onChange: (values: TaskFieldValues) => void
}

// 제목, 내용, 마감 세 칸. 길이 상한은 계약이 판단하므로(safeParse) 여기에 숫자를 적지 않는다.
// 계약에서 제목만 필수이고 내용과 마감은 비울 수 있다.
export function TaskFields({ values, disabled, onChange }: Props) {
  return (
    <>
      <Field label="제목">
        <Input
          aria-required
          value={values.title}
          disabled={disabled}
          onChange={event => onChange({ ...values, title: event.target.value })}
        />
      </Field>
      <Field label="내용" optional>
        <Textarea
          value={values.body}
          disabled={disabled}
          onChange={event => onChange({ ...values, body: event.target.value })}
        />
      </Field>
      <Field label="마감" optional>
        <Input
          type="date"
          value={values.dueDate}
          disabled={disabled}
          onChange={event => onChange({ ...values, dueDate: event.target.value })}
        />
      </Field>
    </>
  )
}
