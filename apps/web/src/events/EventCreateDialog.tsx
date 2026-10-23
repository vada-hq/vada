import { useState } from 'react'
import { CreateEventSchema, type CouncilView, type EventDetail } from '@vada/contracts'
import { eventsPath } from './event-api'
import { emptyEventFields, eventFieldsRequest } from './event-fields'
import { EventDialogShell } from './EventDialogShell'
import { EventForm } from './EventForm'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  view: CouncilView
  onClose: () => void
  onDone: (event: EventDetail) => void
}

// 행사 만들기(회장단). 이름만 받는다.
export function EventCreateDialog({ view, onClose, ...handlers }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <EventDialogShell title="행사 만들기" saving={saving} onClose={onClose}>
      <CreateForm
        view={view}
        saving={saving}
        setSaving={setSaving}
        onClose={onClose}
        {...handlers}
      />
    </EventDialogShell>
  )
}

type FormProps = Props & {
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ view, saving, setSaving, onClose, ...handlers }: FormProps) {
  const [values, setValues] = useState(emptyEventFields)
  const request = { ...eventFieldsRequest(values), ownerId: view.me.memberId }
  const submit = useEventSubmit(eventsPath(view.council.id), CreateEventSchema, request, {
    ...handlers,
    setSaving,
  })
  return (
    <EventForm
      label="행사 만들기"
      submitLabel="만들기"
      values={values}
      onValues={setValues}
      nameOnly
      valid={submit.valid}
      saving={saving}
      problem={submit.problem}
      onSubmit={() => void submit.submit()}
      onCancel={onClose}
    />
  )
}
