import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TaskFieldValues } from './task-fields'

type Props = {
  values: TaskFieldValues
  disabled: boolean
  onChange: (values: TaskFieldValues) => void
}

// 제목, 내용, 마감 세 칸. 길이 상한은 계약이 판단하므로(safeParse) 여기에 숫자를 적지 않는다.
export function TaskFields({ values, disabled, onChange }: Props) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        제목
        <Input
          value={values.title}
          disabled={disabled}
          onChange={event => onChange({ ...values, title: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        내용
        <Textarea
          value={values.body}
          disabled={disabled}
          onChange={event => onChange({ ...values, body: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        마감
        <Input
          type="date"
          value={values.dueDate}
          disabled={disabled}
          onChange={event => onChange({ ...values, dueDate: event.target.value })}
        />
      </Label>
    </>
  )
}
