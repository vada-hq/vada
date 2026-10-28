import { useState, type ReactNode } from 'react'
import {
  statusOf,
  type CouncilView,
  type MeetingDetail,
  type MeetingResponse,
  type TaskCreateOptionsResponse,
} from '@vada/contracts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { TaskCreateDialog } from '@/tasks/TaskCreateDialog'
import type { TaskCreateInitial } from '@/tasks/task-fields'
import { useTaskOptions } from '@/tasks/useTaskOptions'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  view: CouncilView
  meeting: MeetingDetail
  agendaItemId: string | null
  onSaved: (meeting: MeetingDetail) => void
  onForbidden: () => void
}
const noop = () => {}
type Opened = {
  agendaItemId: string
  eventId: string | undefined
  initial: TaskCreateInitial
}

function followUpButton(
  agendaItemId: string | null,
  writable: boolean,
  choices: TaskCreateOptionsResponse | null,
  onOpen: (id: string) => void,
) {
  if (agendaItemId === null || !writable || choices === null || choices.departments.length === 0)
    return null
  return (
    <Button touch size="sm" variant="outline" onClick={() => onOpen(agendaItemId)}>
      {T.createTask}
    </Button>
  )
}

// 열 때의 안건과 행사를 붙잡아 회의를 다시 읽어도 입력 중인 창을 다시 만들지 않는다.
export function useFollowUpCreate({ view, meeting, agendaItemId, onSaved, onForbidden }: Props): {
  button: ReactNode | null
  dialog: ReactNode
} {
  const [opened, setOpened] = useState<Opened | null>(null)
  const writable = meeting.actions.includes('meeting.minutes')
  const enabled = (agendaItemId !== null && writable) || opened !== null
  const eventId = opened ? opened.eventId : meeting.event?.id
  const options = useTaskOptions(view.council.id, eventId, onForbidden, enabled)
  const choices = options.state.kind === 'ready' ? options.state.options : null
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
  return {
    button: followUpButton(agendaItemId, writable, choices, id =>
      setOpened({
        agendaItemId: id,
        eventId: meeting.event?.id,
        initial: {
          departmentId: meeting.hostDepartment?.id ?? null,
          eventId: meeting.event?.id ?? null,
        },
      }),
    ),
    dialog: (
      <>
        <TaskCreateDialog
          open={opened !== null}
          context={{ view, taskView: 'all', dept: null, eventId }}
          options={choices}
          initial={opened?.initial}
          origin={opened ? { agendaItemId: opened.agendaItemId } : undefined}
          onClose={() => setOpened(null)}
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
    ),
  }
}
