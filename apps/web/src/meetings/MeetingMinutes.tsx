import { useEffect, useState, type ReactNode } from 'react'
import type { CouncilView, MeetingAgendaItem, MeetingDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinutesEntryForm } from './MinutesEntryForm'
import { MinutesDiscussion } from './MinutesDiscussion'
import { MinutesDecisions } from './MinutesDecisions'
import {
  MinutesAgendaAdd,
  MinutesAgendaNavigation,
  MinutesMobileAgenda,
  MinutesParticipants,
} from './MinutesNavigation'
import type { useMinutesMutation } from './use-minutes-mutation'
import { MINUTES_TEXT as T, agendaNumber } from './minutes-text'
import type { MinutesDraft } from './minutes-drafts'
import { MinutesScopeContext } from './minutes-scope'
import { MinutesFollowUps } from './MinutesFollowUps'
import { useFollowUpCreate } from './use-follow-up-create'
import { MinutesHeader } from './MinutesHeader'
import { OrphanDrafts } from './MinutesDraftTexts'
import { MeetingMinutesDone } from './MeetingMinutesDone'
import { remainingEntryTexts } from './minutes-confirm'
import { useMinutesSession } from './use-minutes-session'

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
  followUpDialog?: ReactNode
  draft: MinutesDraft | undefined
  orphans: string[]
  submit: ReturnType<typeof useMinutesMutation>
  onChange: (text: string) => void
  onRetry: () => void
  onOverwrite: () => void
  onAdopt: () => void
  onConfirm: () => Promise<string | null>
}
const agendaHasNoLinks = (item: MeetingAgendaItem) =>
  item.decisions.length === 0 && item.followUps.length === 0
// 안건·결정 빼기 확인 창의 상태.
function useMinutesRemoval(submit: ReturnType<typeof useMinutesMutation>) {
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
  return { removing, setRemoving, busy, error, remove, ask }
}
export function MeetingMinutesView({
  councilId,
  followUpCreate: createTask,
  followUpDialog,
  meeting,
  selectedId,
  onSelect,
  draft,
  submit,
  onEdit,
  onCancel,
  orphans,
  onConfirm,
  ...discussion
}: ViewProps) {
  const writable = meeting.actions.includes('meeting.minutes')
  const item = meeting.agenda.find(a => a.id === selectedId) ?? meeting.agenda[0]
  const { removing, setRemoving, busy, error, remove, ask } = useMinutesRemoval(submit)
  const [addOpen, setAddOpen] = useState(false)
  const adding = { open: addOpen, setOpen: setAddOpen }
  const nav = { meeting, selectedId: item ? item.id : null, writable, onSelect, submit, adding }
  return (
    <div className="flex min-w-0 flex-col gap-5 break-keep">
      <MinutesHeader meeting={meeting} onEdit={onEdit} onCancel={onCancel} onConfirm={onConfirm} />
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
              <MinutesFollowUps councilId={councilId} items={item.followUps} create={createTask} />
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
              {writable && <MinutesAgendaAdd submit={submit} adding={adding} />}
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
      {followUpDialog}
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
  const followUp = useFollowUpCreate({ view, meeting, agendaItemId: id, onSaved, onForbidden })
  const { scope, drafts, store, submit, orphans, confirm } = useMinutesSession(
    { base, memberId },
    meeting,
    onSaved,
  )
  useEffect(
    () => () => {
      if (id) store.flush(id)
    },
    [id, store],
  )
  return (
    <MinutesScopeContext value={scope}>
      {meeting.status === 'done' ? (
        <MeetingMinutesDone
          councilId={view.council.id}
          meeting={meeting}
          drafts={drafts}
          orphans={orphans}
          entries={activeForm => remainingEntryTexts(scope, activeForm)}
          submit={submit}
          onAmended={id => store.forget(id)}
        />
      ) : (
        <MeetingMinutesView
          councilId={view.council.id}
          followUpCreate={followUp.button}
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
          onConfirm={confirm}
        />
      )}
      {followUp.dialog}
    </MinutesScopeContext>
  )
}
