import { CALENDAR_KIND_LABELS, SCHEDULE_TYPES, type ScheduleType } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toggleAllDay, type ScheduleFieldProps } from './schedule-form'

export function ScheduleFields({ value, errors, onChange }: ScheduleFieldProps) {
  return (
    <>
      <Field label="제목" required error={errors.title}>
        <Input
          className="max-sm:min-h-11"
          value={value.title}
          onChange={event => onChange({ title: event.target.value })}
        />
      </Field>
      <Field label="종류" required error={errors.type}>
        <RadioGroup
          aria-label="종류"
          className="flex flex-wrap gap-x-4 gap-y-1"
          value={value.type}
          onValueChange={type => onChange({ type: type as ScheduleType })}
        >
          {SCHEDULE_TYPES.map(type => (
            <Label key={type} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value={type} />
              {CALENDAR_KIND_LABELS[type]}
            </Label>
          ))}
        </RadioGroup>
      </Field>
      <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-blue-600"
          checked={value.allDay}
          onChange={event => onChange(toggleAllDay(value, event.target.checked))}
        />
        종일
      </Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={value.allDay ? '시작 날짜' : '시작 시각'} required error={errors.start}>
          <Input
            className="max-sm:min-h-11"
            type={value.allDay ? 'date' : 'datetime-local'}
            value={value.start}
            onChange={event => onChange({ start: event.target.value })}
          />
        </Field>
        <Field label={value.allDay ? '끝 날짜' : '끝 시각'} optional error={errors.end}>
          <Input
            className="max-sm:min-h-11"
            type={value.allDay ? 'date' : 'datetime-local'}
            value={value.end}
            onChange={event => onChange({ end: event.target.value })}
          />
        </Field>
      </div>
      <Field label="장소" optional error={errors.place}>
        <Input
          className="max-sm:min-h-11"
          value={value.place}
          onChange={event => onChange({ place: event.target.value })}
        />
      </Field>
    </>
  )
}
