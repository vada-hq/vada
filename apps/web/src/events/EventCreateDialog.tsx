import { useState } from 'react'
import { CreateEventSchema, type CouncilView, type EventDetail } from '@vada/contracts'
import { openRecord } from '@/lib/go-to'
import { eventsPath } from './event-api'
import { emptyEventFields, eventFieldsRequest } from './event-fields'
import { EventDialogShell } from './EventDialogShell'
import { EventNameField } from './EventFields'
import { EventForm } from './EventForm'
import { announceEventsChanged } from './events-changed'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  view: CouncilView
  // 업무 상세에서 열면 그 업무(기능 015). 만든 행사가 업무에 이어진다.
  taskId?: string
  onClose: () => void
  onDone: (event: EventDetail) => void
}

// 행사 만들기(회장단과 부서장, DEC-93). 이름만 받는다. 만들면 옆 메뉴의 행사 줄이 바로 다시 읽는다.
export function EventCreateDialog({ view, onClose, onDone, ...handlers }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <EventDialogShell title="새 행사" saving={saving} onClose={onClose}>
      <CreateForm
        view={view}
        saving={saving}
        setSaving={setSaving}
        onClose={onClose}
        onDone={event => {
          announceEventsChanged()
          onDone(event)
        }}
        {...handlers}
      />
    </EventDialogShell>
  )
}

// 행사 화면과 홈 빈 상태의 [새 행사]가 같이 여는 새 행사 창: 만들면 창을 닫고 그 행사를 연다.
export function NewEventDialog({
  view,
  onClose,
  onMade,
  ...handlers
}: EventDialogHandlers & { view: CouncilView; onClose: () => void; onMade?: () => void }) {
  return (
    <EventCreateDialog
      view={view}
      onClose={onClose}
      onDone={event => {
        onClose()
        openRecord('events', view.council.id, event.id, { tab: 'overview' })
        onMade?.()
      }}
      {...handlers}
    />
  )
}

type FormProps = Props & {
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ view, saving, setSaving, onClose, taskId, ...handlers }: FormProps) {
  const [values, setValues] = useState(emptyEventFields)
  const request = {
    ...eventFieldsRequest(values),
    ...(taskId ? { taskId } : {}),
  }
  const submit = useEventSubmit(eventsPath(view.council.id), CreateEventSchema, request, {
    ...handlers,
    setSaving,
  })
  return (
    <EventForm
      label="새 행사"
      submitLabel="만들기"
      values={values}
      layout="dialog"
      parsed={submit.parsed}
      saving={saving}
      problem={submit.problem}
      onSubmit={() => void submit.submit()}
      onCancel={onClose}
    >
      {errors => (
        <EventNameField
          autoFocus
          values={values}
          disabled={saving}
          onChange={setValues}
          errors={errors}
        />
      )}
    </EventForm>
  )
}
