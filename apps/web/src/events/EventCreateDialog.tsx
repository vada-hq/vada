import { useState } from 'react'
import {
  CreateEventSchema,
  type CouncilView,
  type EventDetail,
  type TeamResponse,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { eventsPath } from './event-api'
import { emptyEventFields, eventFieldsRequest } from './event-fields'
import { EventDialogShell } from './EventDialogShell'
import { EventForm } from './EventForm'
import { EventTeamGate } from './EventTeamGate'
import { NO_OWNER_LABEL } from './event-view'
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

// 책임자는 만든 사람으로 채운 한 줄로 보이고, [바꾸기]를 누를 때만 선택칸이 펼쳐진다(점진적 공개).
function OwnerPick({
  team,
  ownerId,
  meId,
  saving,
  onChange,
}: {
  team: TeamResponse
  ownerId: string | null
  meId: string
  saving: boolean
  onChange: (id: string | null) => void
}) {
  const [picking, setPicking] = useState(false)
  const choices = ownerChoices(team)
  if (picking)
    return (
      <ChoiceSelect
        label="책임자"
        choices={choices}
        value={ownerId}
        disabled={saving}
        onChange={onChange}
      />
    )
  const name = choices.find(choice => choice.id === ownerId)?.label ?? NO_OWNER_LABEL
  return (
    <p className="flex items-center gap-1 text-sm text-gray-600">
      책임자: {name}
      {ownerId === meId && '(나)'}
      <Button
        type="button"
        variant="link"
        size="sm"
        aria-label="책임자 고르기"
        disabled={saving}
        onClick={() => setPicking(true)}
      >
        바꾸기
      </Button>
    </p>
  )
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
      nameOnly
      extra={
        <OwnerPick
          team={team}
          ownerId={ownerId}
          meId={view.me.memberId}
          saving={saving}
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
