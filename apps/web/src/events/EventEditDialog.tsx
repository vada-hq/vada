import { useState } from 'react'
import { UpdateEventSchema, type EventDetail } from '@vada/contracts'
import { eventFieldsOf, eventFieldsRequest } from './event-fields'
import { eventPath } from './event-api'
import { EventDialogShell } from './EventDialogShell'
import { EventForm } from './EventForm'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  onClose: () => void
  onDone: (event: EventDetail) => void
}

// 이름, 일시, 장소 고치기(책임자). 책임자는 여기서 바꾸지 않는다.
export function EventEditDialog({ councilId, event, onClose, onDone, ...handlers }: Props) {
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
        valid={submit.valid}
        saving={saving}
        problem={submit.problem}
        onSubmit={() => void submit.submit()}
        onCancel={onClose}
      />
    </EventDialogShell>
  )
}
