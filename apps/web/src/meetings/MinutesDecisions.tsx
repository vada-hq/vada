import { useState } from 'react'
import type { MeetingDecision } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinutesEntryForm } from './MinutesEntryForm'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  agendaId: string
  decisions: MeetingDecision[]
  writable: boolean
  submit: (suffix: string, body: object) => Promise<string | null>
  onRemove: (id: string) => void
}
export function MinutesDecisions({ agendaId, decisions, writable, submit, onRemove }: Props) {
  const [editing, setEditing] = useState<MeetingDecision | 'new' | null>(null)
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t pt-5" aria-label={T.decisions}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{T.decisions}</h3>
        {writable && !editing && (
          <Button touch variant="outline" size="sm" onClick={() => setEditing('new')}>
            {T.addDecision}
          </Button>
        )}
      </div>
      {/* 연 폼은 다시 읽기에서 쓰기 동작이 빠져도 남긴다. 저장은 서버가 막고 문구를 보인다. */}
      {editing && (
        <MinutesEntryForm
          key={editing === 'new' ? 'new' : editing.id}
          kind="decision"
          formKey={editing === 'new' ? `decision:new:${agendaId}` : `decision:${editing.id}`}
          agendaId={agendaId}
          initial={
            editing === 'new'
              ? undefined
              : {
                  content: editing.content,
                  rationale: editing.rationale,
                  baseVersionNo: editing.versionNo,
                }
          }
          onSave={value =>
            submit(
              editing === 'new' ? `/agenda/${agendaId}/decisions` : `/decisions/${editing.id}`,
              value,
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
      {decisions.length === 0 && <p className="text-sm text-muted-foreground">{T.emptyDecision}</p>}
      {decisions.map(d => (
        <Card key={d.id} className="flex min-w-0 flex-col gap-3 border-green-200 bg-green-50 p-4">
          <p className="wrap-anywhere text-sm font-medium whitespace-pre-wrap">{d.content}</p>
          {d.rationale && (
            <p className="wrap-anywhere text-sm whitespace-pre-wrap text-muted-foreground">
              {d.rationale}
            </p>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {d.decidedBy && (
              <span className="mr-auto wrap-anywhere text-xs text-muted-foreground">
                {d.decidedBy.name}
              </span>
            )}
            {/* 폼은 한 번에 하나다. 쓰던 폼을 다른 결정의 고치기가 확인 없이 바꾸지 않게 한다. */}
            {writable && !editing && (
              <>
                <Button touch variant="ghost" size="sm" onClick={() => setEditing(d)}>
                  {T.edit}
                </Button>
                <Button touch variant="ghost" size="sm" onClick={() => onRemove(d.id)}>
                  {T.remove}
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </section>
  )
}
