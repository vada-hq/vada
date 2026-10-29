import type { MeetingAgendaItem, MeetingDecision } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinutesAmendForm } from './MinutesAmendForm'
import { MinutesNotes, ReadOnlyDraft } from './MinutesDiscussion'
import { isMinutesDirty, type MinutesDraft } from './minutes-drafts'
import { MINUTES_TEXT as T } from './minutes-text'

export type AmendTarget = { kind: 'agenda' | 'decision'; id: string }
// 저장 못 한 논의 초안으로 고치기를 시작하면, 그 초안이 딛고 선 판과 글을 기준으로 삼는다.
// 그래야 그사이 다른 사람이 고친 논의가 충돌(409)로 드러나고, 다시 저장하기 전에 상대 글을 본다(mtg-6 검토).
function amendStart(item: MeetingAgendaItem, draft: MinutesDraft | undefined) {
  const pending = draft && isMinutesDirty(draft) ? draft : undefined
  const texts = { main: item.title, extra: item.body ?? '' }
  return {
    initial: {
      ...texts,
      notes: pending ? pending.text : (item.notes ?? ''),
      baseVersionNo: pending ? pending.version : item.versionNo,
    },
    baseline: { ...texts, notes: pending ? pendingBase(pending) : (item.notes ?? '') },
  }
}
// 다시 연 화면의 초안은 판만 옛것이고 서버 글은 최신이라 처음 기준 글을 모른다. 그때는 어떤 글과도 다른 값을 기준으로 두어
// 상대 글을 늘 보이고 논의 칸을 보낸다(NUL은 계약이 막아 실제 글과 같을 수 없다, mtg-6 검토).
const UNKNOWN_BASE = '\u0000'
const pendingBase = (draft: MinutesDraft) =>
  draft.server.versionNo === draft.version ? (draft.server.notes ?? '') : UNKNOWN_BASE
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
          current={{ main: decision.content, extra: decision.rationale ?? '', notes: '' }}
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
          {...amendStart(item, draft)}
          current={{ main: item.title, extra: item.body ?? '', notes: item.notes ?? '' }}
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
