import { useState } from 'react'
import {
  appPath,
  menuPath,
  recordPath,
  statusOf,
  type CouncilView,
  type MeetingResponse,
  type MeetingsResponse,
  type MeetingStatus,
  type MeetingDetail as Detail,
  type AppLocation,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { navigate, useHere } from '@/lib/app-location'
import { postJson } from '@/lib/api'
import { openRecord } from '@/lib/go-to'
import { useMenuQuery } from '@/lib/use-menu-query'
import { usePolledRead } from '@/lib/use-polled-read'
import { useAskingGuard } from '@/lib/use-asking-guard'
import { MeetingList } from './MeetingList'
import { MeetingDetail } from './MeetingDetail'
import { MeetingCancelDialog } from './MeetingCancelDialog'
import { MeetingEditor } from './MeetingEditor'
import { MEETING_LOAD_FAILED, MEETING_LOST, meetingError } from './meeting-text'

type Props = { view: CouncilView; onForbidden: () => void }
function ReadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="error">{message}</StateMessage>
      <Button variant="outline" touch onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}
function MeetingsListPage({ view, onForbidden }: Props) {
  const councilId = view.council.id
  const url = useMenuQuery('meetings', councilId)
  const read = usePolledRead<MeetingsResponse>(
    `/api/organizations/${councilId}/meetings?view=council`,
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
  )
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">회의 불러오는 중…</StateMessage>
  if (read.state.kind === 'failed')
    return <ReadFailure message={MEETING_LOAD_FAILED} onRetry={() => void read.reload()} />
  return (
    <MeetingList
      data={read.state.data}
      status={(url.query['status'] as MeetingStatus | undefined) ?? null}
      onStatus={status => url.set({ status })}
      onOpen={id => openRecord('meetings', councilId, id)}
      onCreate={
        view.permissions.includes('meeting.create')
          ? () => navigate(menuPath('meetings', councilId, { compose: 'new' }))
          : undefined
      }
    />
  )
}
function MeetingRecord({ view, onForbidden, id, edit }: Props & { id: string; edit: boolean }) {
  const councilId = view.council.id
  const path = `/api/organizations/${councilId}/meetings/${id}`
  const [lost, setLost] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const read = usePolledRead<MeetingResponse>(path, status => {
    if (status === statusOf('FORBIDDEN') || status === statusOf('NOT_FOUND')) setLost(true)
  })
  const meeting = read.state.kind === 'ready' ? read.state.data.meeting : null
  const guarded = useAskingGuard(asking, cancelProblem(meeting), message => {
    setAsking(false)
    setNotice(message)
  })
  const close = () => navigate(recordPath('meetings', councilId, id), { replace: true })
  const cancel = async (reason: string) => {
    const result = await guarded(
      () => postJson<MeetingResponse>(`${path}/cancel`, { reason }),
      result => result.ok,
    )
    if (!result.ok) {
      if (result.status === statusOf('FORBIDDEN')) onForbidden()
      return meetingError(result.code)
    }
    read.replace(result.data)
    setAsking(false)
    return null
  }
  if (lost)
    return (
      <>
        <StateMessage kind="notice">{MEETING_LOST}</StateMessage>
        <Button
          variant="outline"
          touch
          className="self-start"
          onClick={() => navigate(menuPath('meetings', councilId))}
        >
          회의 목록
        </Button>
      </>
    )
  if (!meeting)
    return read.state.kind === 'failed' ? (
      <ReadFailure message={MEETING_LOAD_FAILED} onRetry={() => void read.reload()} />
    ) : (
      <StateMessage kind="loading">회의 불러오는 중…</StateMessage>
    )
  if (edit && meeting.actions.includes('meeting.edit'))
    return <MeetingEditor view={view} item={meeting} onForbidden={onForbidden} onClose={close} />
  return (
    <>
      {notice && <StateMessage kind="notice">{notice}</StateMessage>}
      <MeetingDetail
        meeting={meeting}
        onEdit={() =>
          navigate(
            appPath({
              type: 'record',
              record: 'meetings',
              councilId,
              recordId: id,
              query: { mode: 'edit' },
            }),
          )
        }
        onCancel={() => setAsking(true)}
        onEvent={eventId => openRecord('events', councilId, eventId, { tab: 'overview' })}
      />
      {asking && <MeetingCancelDialog onClose={() => setAsking(false)} onCancel={cancel} />}
    </>
  )
}
function cancelProblem(meeting: Detail | null) {
  return meeting?.actions.includes('meeting.cancel') ? null : meetingError('FORBIDDEN')
}
function routeOf(location: AppLocation | null, councilId: string) {
  if (!location || location.councilId !== councilId) return { kind: 'list' } as const
  if (location.type === 'record')
    return location.record === 'meetings'
      ? ({
          kind: 'record',
          id: location.recordId,
          edit: location.query['mode'] === 'edit',
        } as const)
      : ({ kind: 'list' } as const)
  return location.menu === 'meetings' && location.query['compose'] === 'new'
    ? ({ kind: 'new' } as const)
    : ({ kind: 'list' } as const)
}
export default function MeetingsPage(props: Props) {
  const { location } = useHere()
  const councilId = props.view.council.id
  const close = () => navigate(menuPath('meetings', councilId))
  const route = routeOf(location, councilId)
  let content
  if (route.kind === 'record')
    content = <MeetingRecord key={route.id} {...props} id={route.id} edit={route.edit} />
  else if (route.kind === 'new' && props.view.permissions.includes('meeting.create'))
    content = <MeetingEditor {...props} onClose={close} />
  else content = <MeetingsListPage {...props} />
  return <PageColumn className="min-w-0 break-keep">{content}</PageColumn>
}
