import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import type { EventFieldValues } from './event-fields'

type Props = {
  values: EventFieldValues
  disabled: boolean
  onChange: (values: EventFieldValues) => void
  // 만들기는 이름만 받고 일시·장소는 만든 뒤 상세에서 채운다. 이름 칸에 바로 포커스를 둔다.
  nameOnly?: boolean | undefined
  // 상세의 [일시 넣기]·[장소 넣기]로 열었으면 그 칸에 포커스를 둔다.
  focus?: EventFieldFocus | undefined
  // 저장을 누른 뒤의 문제(칸 이름 → 글).
  errors?: FieldErrors | undefined
}

export type EventFieldFocus = 'startsAt' | 'place'

// 이름, 시작, 끝, 장소 네 칸. 길이 상한과 시작·끝 순서는 계약이 판단하므로(safeParse) 여기에 적지 않는다.
// 계약에서 이름만 필수이고 나머지는 비울 수 있다(CreateEventSchema·UpdateEventSchema의 nullable).
export function EventFields({ values, disabled, onChange, nameOnly, focus, errors = {} }: Props) {
  const name = (
    <Field label="이름" required error={errors.name}>
      <Input
        // 대화상자가 열리는 순간에는 팀을 읽는 중이라 이름 칸이 없고 포커스가 닫기(×)에 간다. 칸이 생길 때 옮긴다.
        autoFocus={nameOnly}
        value={values.name}
        disabled={disabled}
        onChange={event => onChange({ ...values, name: event.target.value })}
      />
    </Field>
  )
  if (nameOnly) return name
  return (
    <>
      {name}
      <Field label="시작" optional error={errors.startsAt}>
        <Input
          type="datetime-local"
          autoFocus={focus === 'startsAt'}
          value={values.startsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, startsAt: event.target.value })}
        />
      </Field>
      <Field label="끝" optional error={errors.endsAt}>
        <Input
          type="datetime-local"
          value={values.endsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, endsAt: event.target.value })}
        />
      </Field>
      <Field label="장소" optional>
        <Input
          autoFocus={focus === 'place'}
          value={values.place}
          disabled={disabled}
          onChange={event => onChange({ ...values, place: event.target.value })}
        />
      </Field>
    </>
  )
}
