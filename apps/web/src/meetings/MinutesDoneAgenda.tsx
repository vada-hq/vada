import type { MeetingAgendaItem, MeetingDecision } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinutesAmendForm } from './MinutesAmendForm'
import { MinutesNotes, ReadOnlyDraft } from './MinutesDiscussion'
import { isMinutesDirty, type MinutesDraft } from './minutes-drafts'
import { MINUTES_TEXT as T } from './minutes-text'

export type AmendTarget = { kind: 'agenda' | 'decision'; id: string }
function amendNotes(item: MeetingAgendaItem, draft: MinutesDraft | undefined) {
  return draft && isMinutesDirty(draft) ? draft.text : (item.notes ?? '')
}
type Props = {
  item: MeetingAgendaItem
  draft: MinutesDraft | undefined
  amendable: boolean
  editing: AmendTarget | null
  onEdit: (target: AmendTarget | null) => void
  submit: (suffix: string, value: object) => Promise<string | null>
  onAmended: (id: string) => void
}
function DoneDecision({
  decision,
  item,
  editing,
  onEdit,
  amendable,
  submit,
}: Omit<Props, 'draft' | 'onAmended'> & { decision: MeetingDecision }) {
  const active = editing?.kind === 'decision' && editing.id === decision.id
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-sm border border-green-200 bg-green-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-green-700">{T.confirmedDecisions}</h4>
        {amendable && !editing && (
          <Button
            touch
            variant="ghost"
            size="sm"
            onClick={() => onEdit({ kind: 'decision', id: decision.id })}
          >
            {T.edit}
          </Button>
        )}
      </div>
      {active ? (
        <MinutesAmendForm
          key={decision.id}
          kind="decision"
          id={decision.id}
          agendaId={item.id}
          initial={{
            main: decision.content,
            extra: decision.rationale ?? '',
            notes: '',
            baseVersionNo: decision.versionNo,
          }}
          onSave={value => submit(`/decisions/${decision.id}`, value)}
          onClose={() => onEdit(null)}
        />
      ) : (
        <>
          <p className="wrap-anywhere text-sm whitespace-pre-wrap text-green-800">
            {decision.content}
          </p>
          {decision.rationale && (
            <p className="wrap-anywhere text-xs whitespace-pre-wrap text-muted-foreground">
              {decision.rationale}
            </p>
          )}
        </>
      )}
    </div>
  )
}
export function MinutesDoneAgenda({
  item,
  draft,
  amendable,
  editing,
  onEdit,
  submit,
  onAmended,
}: Props) {
  const active = editing?.kind === 'agenda' && editing.id === item.id
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600 tabular-nums">
          {item.position}
        </span>
        <h3 className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold">{item.title}</h3>
        {amendable && !editing && (
          <Button
            touch
            variant="outline"
            size="sm"
            onClick={() => onEdit({ kind: 'agenda', id: item.id })}
          >
            {T.edit}
          </Button>
        )}
      </div>
      {active ? (
        <MinutesAmendForm
          key={item.id}
          kind="agenda"
          id={item.id}
          agendaId={item.id}
          initial={{
            main: item.title,
            extra: item.body ?? '',
            notes: amendNotes(item, draft),
            baseVersionNo: item.versionNo,
          }}
          onSave={async value => {
            const problem = await submit(`/agenda/${item.id}`, value)
            if (!problem) onAmended(item.id)
            return problem
          }}
          onClose={() => onEdit(null)}
        />
      ) : (
        <>
          {item.body && (
            <p className="wrap-anywhere text-xs whitespace-pre-wrap text-muted-foreground">
              {item.body}
            </p>
          )}
          <MinutesNotes text={item.notes} />
          <ReadOnlyDraft draft={draft} writable={false} />
        </>
      )}
      {item.decisions.map(decision => (
        <DoneDecision
          key={decision.id}
          decision={decision}
          item={item}
          editing={editing}
          onEdit={onEdit}
          amendable={amendable}
          submit={submit}
        />
      ))}
    </Card>
  )
}
