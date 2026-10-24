import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { requiredText, useFormCheck } from '@/lib/use-form-check'
import type { EventFieldValues } from './event-fields'
import { EventFields, type EventFieldFocus } from './EventFields'

type Props = {
  label: string
  submitLabel: string
  values: EventFieldValues
  onValues: (values: EventFieldValues) => void
  // 만들기는 이름만 받는다(EventFields).
  nameOnly?: boolean
  focus?: EventFieldFocus | undefined
  valid: boolean
  saving: boolean
  problem: string | null
  onSubmit: () => void
  onCancel: () => void
}

// 이름은 늘 필수이고, 끝을 넣었으면 시작도 필수다(계약: 끝만 있는 행사는 없다). 끝은 시작보다 늦어야 한다.
const eventErrors = (values: EventFieldValues) => ({
  name: requiredText(values.name, '이름을'),
  startsAt: values.endsAt === '' ? undefined : requiredText(values.startsAt, '시작을'),
  endsAt:
    values.startsAt !== '' && values.endsAt !== '' && values.endsAt <= values.startsAt
      ? '시작보다 늦은 시각을 입력해 주세요'
      : undefined,
})

// 행사 만들기·고치기 폼. 버튼은 끄지 않고 누를 때 확인한다. 보내는 동안 모든 칸과 버튼을 막는다.
export function EventForm(props: Props) {
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => eventErrors(props.values))
  return (
    <form
      ref={formRef}
      noValidate
      aria-label={props.label}
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt() && props.valid) props.onSubmit()
      }}
    >
      <EventFields
        values={props.values}
        disabled={props.saving}
        onChange={props.onValues}
        nameOnly={props.nameOnly}
        focus={props.focus}
        errors={fieldErrors}
      />
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={props.saving} onClick={props.onCancel}>
          닫기
        </Button>
        <Button type="submit" disabled={props.saving}>
          {props.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
