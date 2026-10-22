import { useState } from 'react'
import { SetEventOwnerSchema, type EventDetail, type TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { eventPath } from './event-api'
import { EventDialogShell } from './EventDialogShell'
import { EventTeamGate } from './EventTeamGate'
import { ownerChoices } from './owner-choices'
import { useEventSubmit, type EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  onClose: () => void
  onDone: (event: EventDetail) => void
}

// 책임자 바꾸기와 비우기(회장단).
export function EventOwnerDialog({ councilId, event, onClose, ...handlers }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <EventDialogShell title="책임자 바꾸기" saving={saving} onClose={onClose}>
      <EventTeamGate councilId={councilId} onForbidden={handlers.onForbidden}>
        {team => (
          <OwnerForm
            councilId={councilId}
            event={event}
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

function OwnerForm({ councilId, event, team, saving, setSaving, onClose, ...handlers }: FormProps) {
  const choices = ownerChoices(team)
  const current = event.owner?.id ?? null
  // 떠난 책임자는 선택지에 없어, '책임자 없음'이 골라진 채 시작한다.
  const [ownerId, setOwnerId] = useState(choices.some(item => item.id === current) ? current : null)
  const submit = useEventSubmit(
    `${eventPath(councilId, event.id)}/owner`,
    SetEventOwnerSchema,
    { ownerId },
    { ...handlers, setSaving },
  )
  const unchanged = ownerId === current
  return (
    <form
      aria-label="책임자 바꾸기"
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault()
        if (!unchanged) void submit.submit()
      }}
    >
      <ChoiceSelect
        label="책임자"
        choices={choices}
        value={ownerId}
        disabled={saving}
        onChange={setOwnerId}
      />
      {submit.problem && <StateMessage kind="error">{submit.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={unchanged || saving}>
          저장
        </Button>
      </DialogFooter>
    </form>
  )
}
