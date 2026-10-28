import { useEffect, useState } from 'react'
import type { MeetingAgendaItem, MeetingDetail } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MEETING_STATUS } from './meeting-text'
import { meetingTime } from './meeting-view'
import { MinutesEntryForm } from './MinutesEntryForm'
import { MinutesDiscussion } from './MinutesDiscussion'
import { MinutesDecisions } from './MinutesDecisions'
import {
  MinutesAgendaAdd,
  MinutesAgendaNavigation,
  MinutesMobileAgenda,
  MinutesParticipants,
} from './MinutesNavigation'
import { useMinutesAutosave } from './use-minutes-autosave'
import { useMinutesMutation } from './use-minutes-mutation'
import { MINUTES_TEXT as T, agendaNumber, participantCount } from './minutes-text'
import type { MinutesDraft } from './minutes-drafts'

type Props = {
  meeting: MeetingDetail
  base: string
  selectedId: string | null
  onSelect: (id: string) => void
  onSaved: (meeting: MeetingDetail) => void
}
function MinutesHeader({ meeting }: Pick<Props, 'meeting'>) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <>
      <PageHeading trail={{ title: '회의', crumbs: [{ label: meeting.title, truncate: true }] }}>
        <h1 className="wrap-anywhere text-xl font-semibold">{meeting.title}</h1>
      </PageHeading>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4 text-sm text-muted-foreground">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="tabular-nums">{meetingTime(meeting.heldAt, meeting.endsAt)}</span>
        {meeting.place && <span className="wrap-anywhere">{meeting.place}</span>}
        <span className="sm:ml-auto">{participantCount(meeting.attendeeCount)}</span>
      </div>
    </>
  )
}
function MinutesAgendaHeading({
  item,
  writable,
  submit,
}: {
  item: MeetingAgendaItem
  writable: boolean
  submit: ReturnType<typeof useMinutesMutation>
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-primary tabular-nums">
          {agendaNumber(item.position)}
        </p>
        {writable && (
          <Button touch variant="outline" size="sm" onClick={() => setEditing(true)}>
            {T.editAgenda}
          </Button>
        )}
      </div>
      <h2 className="wrap-anywhere text-lg font-semibold">{item.title}</h2>
      {item.body && (
        <p className="wrap-anywhere text-sm whitespace-pre-wrap text-muted-foreground">
          {item.body}
        </p>
      )}
      {editing && writable && (
        <MinutesEntryForm
          kind="agenda"
          initial={{ title: item.title, body: item.body, baseVersionNo: item.versionNo }}
          onSave={value => submit(`/agenda/${item.id}`, value)}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
type ViewProps = Pick<Props, 'meeting' | 'selectedId' | 'onSelect'> & {
  draft: MinutesDraft | undefined
  submit: ReturnType<typeof useMinutesMutation>
  onChange: (text: string) => void
  onRetry: () => void
  onOverwrite: () => void
  onAdopt: () => void
}
export function MeetingMinutesView({
  meeting,
  selectedId,
  onSelect,
  draft,
  submit,
  ...discussion
}: ViewProps) {
  const writable = meeting.actions.includes('meeting.minutes')
  const item = meeting.agenda.find(a => a.id === selectedId) ?? meeting.agenda[0]
  const id = item ? item.id : null
  const [removing, setRemoving] = useState<{ kind: 'agenda' | 'decision'; id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    if (!removing || busy) return
    setBusy(true)
    const problem = await submit(
      `/${removing.kind === 'agenda' ? 'agenda' : 'decisions'}/${removing.id}/cancel`,
      {},
    )
    setBusy(false)
    setError(problem)
    if (!problem) setRemoving(null)
  }
  const ask = (kind: 'agenda' | 'decision', target: string) => {
    setError(null)
    setRemoving({ kind, id: target })
  }
  const nav = { meeting, selectedId: id, writable, onSelect, submit }
  return (
    <div className="flex min-w-0 flex-col gap-5 break-keep">
      <MinutesHeader meeting={meeting} />
      <MinutesMobileAgenda {...nav} />
      <div className="grid min-w-0 gap-5 sm:grid-cols-3">
        <Card className="flex min-w-0 flex-col gap-5 p-5 sm:col-span-2 sm:p-6">
          {item ? (
            <>
              <MinutesAgendaHeading
                key={`${item.id}-heading`}
                item={item}
                writable={writable}
                submit={submit}
              />
              <MinutesDiscussion item={item} draft={draft} writable={writable} {...discussion} />
              <MinutesDecisions
                key={`${item.id}-decisions`}
                agendaId={item.id}
                decisions={item.decisions}
                writable={writable}
                submit={submit}
                onRemove={target => ask('decision', target)}
              />
              {writable && item.decisions.length === 0 && (
                <Button
                  touch
                  variant="outline"
                  className="self-start"
                  onClick={() => ask('agenda', item.id)}
                >
                  {T.removeAgenda}
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{T.emptyAgenda}</p>
              {writable && <MinutesAgendaAdd submit={submit} />}
            </>
          )}
        </Card>
        <aside className="flex min-w-0 flex-col gap-5">
          <MinutesAgendaNavigation {...nav} />
          <MinutesParticipants meeting={meeting} />
        </aside>
      </div>
      {removing && (
        <ConfirmDialog
          title={removing.kind === 'agenda' ? T.removeAgendaQuestion : T.removeDecisionQuestion}
          confirmLabel={removing.kind === 'agenda' ? T.removeAgenda : T.remove}
          touch
          busy={busy}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
export function MeetingMinutes({ meeting, base, selectedId, onSelect, onSaved }: Props) {
  const item = meeting.agenda.find(a => a.id === selectedId) ?? meeting.agenda[0]
  const id = item?.id ?? null
  const { drafts, store } = useMinutesAutosave(base, meeting, onSaved)
  const mutate = useMinutesMutation(base, onSaved)
  const submit = async (suffix: string, body: object) => {
    const problem = await mutate(suffix, body)
    // 사람이 안건 빼기를 확인하고 서버도 처리한 뒤에만 그 안건의 초안을 버린다.
    if (!problem && /^\/agenda\/[^/]+\/cancel$/.test(suffix)) store.forget(suffix.split('/')[2]!)
    return problem
  }
  useEffect(
    () => () => {
      if (id) store.flush(id)
    },
    [id, store],
  )
  return (
    <MeetingMinutesView
      meeting={meeting}
      selectedId={id}
      draft={id ? drafts.get(id) : undefined}
      submit={submit}
      onSelect={next => {
        if (id) store.flush(id)
        onSelect(next)
      }}
      onChange={text => {
        if (id) store.change(id, text)
      }}
      onRetry={() => {
        if (id) void store.save(id)
      }}
      onOverwrite={() => {
        if (id) store.overwrite(id)
      }}
      onAdopt={() => {
        if (id) store.adopt(id)
      }}
    />
  )
}
