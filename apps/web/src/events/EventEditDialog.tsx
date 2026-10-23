import { useState } from 'react'
import { UpdateEventSchema, type EventDetail } from '@vada/contracts'
import { eventFieldsOf, eventFieldsRequest } from './event-fields'
import { eventPath } from './event-api'
import { EventDialogShell } from './EventDialogShell'
import { EventForm } from './EventForm'
import type { EventFieldFocus } from './EventFields'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  onClose: () => void
  onDone: (event: EventDetail) => void
  focus?: EventFieldFocus | undefined
}

// 이름, 일시, 장소 고치기.
export function EventEditDialog({ councilId, event, onClose, onDone, focus, ...handlers }: Props) {
  const [values, setValues] = useState(eventFieldsOf(event))
  const [saving, setSaving] = useState(false)
  const request = eventFieldsRequest(values)
  const submit = useEventSubmit(eventPath(councilId, event.id), UpdateEventSchema, request, {
    ...handlers,
    onDone,
    setSaving,
  })
  return (
    <EventDialogShell title="행사 고치기" saving={saving} onClose={onClose}>
      <EventForm
        label="행사 고치기"
        submitLabel="저장"
        values={values}
        onValues={setValues}
        focus={focus}
        valid={submit.valid}
        saving={saving}
        problem={submit.problem}
        onSubmit={() => void submit.submit()}
        onCancel={onClose}
      />
    </EventDialogShell>
  )
}
