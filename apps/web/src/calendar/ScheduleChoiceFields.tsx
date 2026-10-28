import type { ReactNode } from 'react'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ScheduleChoice, ScheduleFieldProps } from './schedule-form'

type Props = ScheduleFieldProps & {
  departments: ScheduleChoice[]
  events: ScheduleChoice[]
  optionsNotice?: ReactNode
}
const MEMO_ROWS = 3

export function ScheduleChoiceFields({
  value,
  errors,
  onChange,
  departments,
  events,
  optionsNotice,
}: Props) {
  return (
    <>
      <Field label="부서" optional error={errors.departmentId}>
        <NativeSelect
          className="max-sm:min-h-11"
          value={value.departmentId}
          onChange={event => onChange({ departmentId: event.target.value, visibility: 'council' })}
        >
          <option value="">부서 없음</option>
          {departments.map(option => (
            <option key={option.id} value={option.id} disabled={option.disabled}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {value.departmentId && (
        <Field label="공개 범위" required error={errors.visibility}>
          <RadioGroup
            aria-label="공개 범위"
            value={value.visibility}
            onValueChange={visibility =>
              onChange({ visibility: visibility === 'department' ? 'department' : 'council' })
            }
          >
            <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="council" />
              전체 운영진
            </Label>
            <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="department" />이 부서만
            </Label>
          </RadioGroup>
        </Field>
      )}
      <Field label="행사" optional error={errors.eventId}>
        <NativeSelect
          className="max-sm:min-h-11"
          value={value.eventId}
          onChange={event => onChange({ eventId: event.target.value })}
        >
          <option value="">행사 없음</option>
          {events.map(option => (
            <option key={option.id} value={option.id} disabled={option.disabled}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {optionsNotice}
      <Field label="메모" optional error={errors.memo}>
        <Textarea
          rows={MEMO_ROWS}
          value={value.memo}
          onChange={event => onChange({ memo: event.target.value })}
        />
      </Field>
    </>
  )
}
