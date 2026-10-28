import { useState } from 'react'
import {
  statusOf,
  type CouncilView,
  type MeetingDetail,
  type MeetingResponse,
} from '@vada/contracts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { TaskCreateDialog } from '@/tasks/TaskCreateDialog'
import { useTaskCreateEntry } from '@/tasks/useTaskCreateEntry'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  view: CouncilView
  meeting: MeetingDetail
  agendaItemId: string | null
  onSaved: (meeting: MeetingDetail) => void
  onForbidden: () => void
}
const noop = () => {}

export function MinutesFollowUpCreate(props: Props) {
  if (!props.agendaItemId || !props.meeting.actions.includes('meeting.minutes')) return null
  return <OpenFollowUpCreate {...props} agendaItemId={props.agendaItemId} />
}

function OpenFollowUpCreate({
  view,
  meeting,
  agendaItemId,
  onSaved,
  onForbidden,
}: Props & { agendaItemId: string }) {
  const entry = useTaskCreateEntry(
    { view, taskView: 'all', dept: null, eventId: meeting.event?.id },
    onForbidden,
  )
  const [failed, setFailed] = useState(false)
  const active = useActive()
  const reload = async () => {
    const result = await getJson<MeetingResponse>(
      `/api/organizations/${view.council.id}/meetings/${meeting.id}`,
    )
    if (!active()) return
    setFailed(!result.ok)
    if (result.ok) onSaved(result.data.meeting)
    else if (result.status === statusOf('FORBIDDEN')) onForbidden()
  }
  return (
    <>
      {entry.available && (
        <Button
          touch
          size="sm"
          variant="outline"
          onClick={() =>
            entry.open({
              departmentId: meeting.hostDepartment?.id ?? null,
              eventId: meeting.event?.id ?? null,
            })
          }
        >
          {T.createTask}
        </Button>
      )}
      <TaskCreateDialog
        open={entry.initial !== null}
        context={entry.context}
        options={entry.choices}
        initial={entry.initial ?? undefined}
        origin={{ agendaItemId }}
        onClose={entry.close}
        onCreated={() => void reload()}
        onOpenTask={noop}
        onForbidden={onForbidden}
      />
      {failed && (
        <Alert tone="warning" role="status">
          {T.refreshFailed}
          <Button touch variant="link" onClick={() => void reload()}>
            {T.refresh}
          </Button>
        </Alert>
      )}
    </>
  )
}
