import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { EventFieldValues } from './event-fields'

type Props = {
  values: EventFieldValues
  disabled: boolean
  onChange: (values: EventFieldValues) => void
}

// 이름, 시작, 끝, 장소 네 칸. 길이 상한과 시작·끝 순서는 계약이 판단하므로(safeParse) 여기에 적지 않는다.
// 계약에서 이름만 필수이고 나머지는 비울 수 있다(CreateEventSchema·UpdateEventSchema의 nullable).
export function EventFields({ values, disabled, onChange }: Props) {
  return (
    <>
      <Field label="이름">
        <Input
          aria-required
          value={values.name}
          disabled={disabled}
          onChange={event => onChange({ ...values, name: event.target.value })}
        />
      </Field>
      <Field label="시작" optional>
        <Input
          type="datetime-local"
          value={values.startsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, startsAt: event.target.value })}
        />
      </Field>
      <Field label="끝" optional>
        <Input
          type="datetime-local"
          value={values.endsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, endsAt: event.target.value })}
        />
      </Field>
      <Field label="장소" optional>
        <Input
          value={values.place}
          disabled={disabled}
          onChange={event => onChange({ ...values, place: event.target.value })}
        />
      </Field>
    </>
  )
}
