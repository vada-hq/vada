import { useState } from 'react'
import {
  CreateEventSchema,
  type CouncilView,
  type EventDetail,
  type TeamResponse,
} from '@vada/contracts'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { eventsPath } from './event-api'
import { emptyEventFields, eventFieldsRequest } from './event-fields'
import { EventDialogShell } from './EventDialogShell'
import { EventForm } from './EventForm'
import { EventTeamGate } from './EventTeamGate'
import { ownerChoices } from './owner-choices'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  view: CouncilView
  onClose: () => void
  onDone: (event: EventDetail) => void
}

// 행사 만들기(회장단). 책임자는 만든 사람으로 채우고 비울 수 있다.
export function EventCreateDialog({ view, onClose, ...handlers }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <EventDialogShell title="행사 만들기" saving={saving} onClose={onClose}>
      <EventTeamGate councilId={view.council.id} onForbidden={handlers.onForbidden}>
        {team => (
          <CreateForm
            view={view}
            team={team}
            saving={saving}
            setSaving={setSaving}
            onClose={onClose}
            {...handlers}
          />
        )}
      </EventTeamGate>
    </EventDialogShell>
  )
}

type FormProps = Props & {
  team: TeamResponse
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ view, team, saving, setSaving, onClose, ...handlers }: FormProps) {
  const [values, setValues] = useState(emptyEventFields)
  const [ownerId, setOwnerId] = useState<string | null>(view.me.memberId)
  const request = { ...eventFieldsRequest(values), ownerId }
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
      extra={
        <ChoiceSelect
          label="책임자"
          choices={ownerChoices(team)}
          value={ownerId}
          disabled={saving}
          onChange={setOwnerId}
        />
      }
      valid={submit.valid}
      saving={saving}
      problem={submit.problem}
      onSubmit={() => void submit.submit()}
      onCancel={onClose}
    />
  )
}
