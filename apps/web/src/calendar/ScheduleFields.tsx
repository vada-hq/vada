import type { ComponentProps } from 'react'
import { CALENDAR_KIND_LABELS, SCHEDULE_TYPES, type ScheduleType } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { DateField } from '@/components/ui/date-field'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toggleAllDay, type ScheduleFieldProps } from './schedule-form'

type MomentProps = Omit<ComponentProps<typeof DateTimeField>, 'timeLabel'> & {
  allDay: boolean
  timeLabel: string
}

// 종일이면 날짜만, 아니면 날짜와 시각을 고른다. 값은 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm' 그대로다.
function ScheduleMoment({ allDay, timeLabel, ...props }: MomentProps) {
  return allDay ? <DateField {...props} /> : <DateTimeField timeLabel={timeLabel} {...props} />
}

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
          className="size-4 accent-primary-emphasis"
          checked={value.allDay}
          onChange={event => onChange(toggleAllDay(value, event.target.checked))}
        />
        종일
      </Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={value.allDay ? '시작 날짜' : '시작 시각'} required error={errors.start}>
          <ScheduleMoment
            allDay={value.allDay}
            timeLabel="시작 시간"
            value={value.start}
            onChange={start => onChange({ start })}
          />
        </Field>
        <Field label={value.allDay ? '끝 날짜' : '끝 시각'} optional error={errors.end}>
          <ScheduleMoment
            allDay={value.allDay}
            timeLabel="끝 시간"
            clearable
            value={value.end}
            onChange={end => onChange({ end })}
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
