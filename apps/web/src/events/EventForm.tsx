import type { ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { MissingHint, missingLabels } from '@/components/ui/field'
import type { EventFieldValues } from './event-fields'
import { EventFields, type EventFieldFocus } from './EventFields'

type Props = {
  label: string
  submitLabel: string
  values: EventFieldValues
  onValues: (values: EventFieldValues) => void
  // 책임자 고르기 같은 칸. 만들기에만 있다.
  extra?: ReactNode
  // 만들기는 이름만 받는다(EventFields).
  nameOnly?: boolean
  focus?: EventFieldFocus | undefined
  valid: boolean
  saving: boolean
  problem: string | null
  onSubmit: () => void
  onCancel: () => void
}

// 행사 만들기·고치기 폼. 오류는 버튼 옆에 보이고, 보내는 동안 모든 칸과 버튼을 막는다.
export function EventForm(props: Props) {
  return (
    <form
      aria-label={props.label}
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        props.onSubmit()
      }}
    >
      <EventFields
        values={props.values}
        disabled={props.saving}
        onChange={props.onValues}
        nameOnly={props.nameOnly}
        focus={props.focus}
      />
      {props.extra}
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
      <DialogFooter>
        <MissingHint missing={missingLabels([['이름', props.values.name]])} />
        <Button type="button" variant="outline" disabled={props.saving} onClick={props.onCancel}>
          닫기
        </Button>
        <Button type="submit" disabled={!props.valid || props.saving}>
          {props.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
