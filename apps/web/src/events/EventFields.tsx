import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EventFieldValues } from './event-fields'

type Props = {
  values: EventFieldValues
  disabled: boolean
  onChange: (values: EventFieldValues) => void
}

// 이름, 시작, 끝, 장소 네 칸. 길이 상한과 시작·끝 순서는 계약이 판단하므로(safeParse) 여기에 적지 않는다.
export function EventFields({ values, disabled, onChange }: Props) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        이름
        <Input
          value={values.name}
          disabled={disabled}
          onChange={event => onChange({ ...values, name: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        시작
        <Input
          type="datetime-local"
          value={values.startsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, startsAt: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        끝
        <Input
          type="datetime-local"
          value={values.endsAt}
          disabled={disabled}
          onChange={event => onChange({ ...values, endsAt: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        장소
        <Input
          value={values.place}
          disabled={disabled}
          onChange={event => onChange({ ...values, place: event.target.value })}
        />
      </Label>
    </>
  )
}
