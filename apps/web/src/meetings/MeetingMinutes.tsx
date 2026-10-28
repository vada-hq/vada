import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CouncilView, MeetingAgendaItem, MeetingDetail } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MEETING_STATUS } from './meeting-text'
import { MeetingActions } from './MeetingActions'
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
import { isMinutesDirty, lostEntries, type MinutesDraft } from './minutes-drafts'
import { MinutesScopeContext } from './minutes-scope'
import { MinutesFollowUps } from './MinutesFollowUps'
import { MinutesFollowUpCreate } from './MinutesFollowUpCreate'

type Props = {
  view: CouncilView
  meeting: MeetingDetail
  base: string
  memberId: string
  selectedId: string | null
  onSelect: (id: string) => void
  onSaved: (meeting: MeetingDetail) => void
  onEdit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  onForbidden?: (() => void) | undefined
}
// 다른 사람이 뺀 안건에 쓰던 글은 저장할 곳이 없으므로 옮겨 쓸 수 있게 보인다(mtg-4 검토).
function OrphanDrafts({ texts }: { texts: string[] }) {
  return texts.map((text, index) => (
    <Alert key={index} tone="warning" role="status" className="flex flex-col gap-2 text-sm">
      <p className="font-medium">{T.orphan}</p>
      <p className="whitespace-pre-wrap text-gray-800">{text}</p>
    </Alert>
  ))
}
function MinutesHeader({
  meeting,
  onEdit,
  onCancel,
}: Pick<Props, 'meeting' | 'onEdit' | 'onCancel'>) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <>
      <PageHeading trail={{ title: '회의', crumbs: [{ label: meeting.title, truncate: true }] }}>
        <h1 className="wrap-anywhere text-xl font-semibold">{meeting.title}</h1>
      </PageHeading>
      {/* 진행 중·정리 중에는 이 화면만 열리므로 다루는 사람의 고치기·취소도 여기 둔다(mtg-4 검토). */}
      <MeetingActions meeting={meeting} onEdit={onEdit} onCancel={onCancel} />
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
      {editing && (
        <MinutesEntryForm
          kind="agenda"
          formKey={`agenda:${item.id}`}
          agendaId={item.id}
          initial={{ title: item.title, body: item.body, baseVersionNo: item.versionNo }}
          onSave={value => submit(`/agenda/${item.id}`, value)}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
type ViewProps = Pick<Props, 'meeting' | 'selectedId' | 'onSelect' | 'onEdit' | 'onCancel'> & {
  councilId: string
  followUpCreate?: ReactNode
  draft: MinutesDraft | undefined
  orphans: string[]
  submit: ReturnType<typeof useMinutesMutation>
  onChange: (text: string) => void
  onRetry: () => void
  onOverwrite: () => void
  onAdopt: () => void
}
const agendaHasNoLinks = (item: MeetingAgendaItem) =>
  item.decisions.length === 0 && item.followUps.length === 0
export function MeetingMinutesView({
  councilId,
  followUpCreate,
  meeting,
  selectedId,
  onSelect,
  draft,
  submit,
  onEdit,
  onCancel,
  orphans,
  ...discussion
}: ViewProps) {
  const writable = meeting.actions.includes('meeting.minutes')
  const item = meeting.agenda.find(a => a.id === selectedId) ?? meeting.agenda[0]
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
  const nav = { meeting, selectedId: item ? item.id : null, writable, onSelect, submit }
  return (
    <div className="flex min-w-0 flex-col gap-5 break-keep">
      <MinutesHeader meeting={meeting} onEdit={onEdit} onCancel={onCancel} />
      <OrphanDrafts texts={orphans} />
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
              <MinutesFollowUps
                councilId={councilId}
                items={item.followUps}
                create={followUpCreate}
              />
              {writable && agendaHasNoLinks(item) && (
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
export function MeetingMinutes({
  view,
  meeting,
  base,
  memberId,
  selectedId,
  onSelect,
  onSaved,
  onEdit,
  onCancel,
  onForbidden = () => {},
}: Props) {
  const item = meeting.agenda.find(a => a.id === selectedId) ?? meeting.agenda[0]
  const id = item?.id ?? null
  const scope = useMemo(() => ({ base, memberId }), [base, memberId])
  const { drafts, store } = useMinutesAutosave(scope, meeting, onSaved)
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
  const agendaIds = meeting.agenda.map(a => a.id)
  const orphans = [
    ...store.lostTexts(),
    ...[...drafts]
      .filter(([key, d]) => isMinutesDirty(d) && !agendaIds.includes(key))
      .map(([, d]) => d.text),
    ...lostEntries(scope, agendaIds),
  ]
  return (
    <MinutesScopeContext value={scope}>
      <MeetingMinutesView
        councilId={view.council.id}
        followUpCreate={
          <MinutesFollowUpCreate
            key={id}
            view={view}
            meeting={meeting}
            agendaItemId={id}
            onSaved={onSaved}
            onForbidden={onForbidden}
          />
        }
        meeting={meeting}
        selectedId={id}
        draft={id ? drafts.get(id) : undefined}
        orphans={orphans}
        onEdit={onEdit}
        onCancel={onCancel}
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
    </MinutesScopeContext>
  )
}
