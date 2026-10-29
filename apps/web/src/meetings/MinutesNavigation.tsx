import { useState } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinutesEntryForm } from './MinutesEntryForm'
import { useMinutesWide } from './use-minutes-wide'
import {
  MINUTES_TEXT as T,
  agendaNumber,
  agendaProgress,
  decisionCount,
  followUpCount,
} from './minutes-text'

type Props = {
  meeting: MeetingDetail
  selectedId: string | null
  writable: boolean
  onSelect: (id: string) => void
  submit: (suffix: string, body: object) => Promise<string | null>
}
export function MinutesAgendaAdd({ submit }: Pick<Props, 'submit'>) {
  const [adding, setAdding] = useState(false)
  return adding ? (
    <MinutesEntryForm
      kind="agenda"
      formKey="agenda:new"
      agendaId={null}
      onSave={value => submit('/agenda', value)}
      onClose={() => setAdding(false)}
    />
  ) : (
    <Button touch variant="outline" onClick={() => setAdding(true)}>
      {T.addAgenda}
    </Button>
  )
}
export function MinutesMobileAgenda({ meeting, selectedId, onSelect, writable, submit }: Props) {
  const wide = useMinutesWide()
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:hidden">
      <nav aria-label={T.agendas} className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {meeting.agenda.map(a => (
          <Button
            key={a.id}
            touch
            variant={a.id === selectedId ? 'default' : 'outline'}
            className="max-w-64 shrink-0 whitespace-normal"
            aria-pressed={a.id === selectedId}
            onClick={() => onSelect(a.id)}
          >
            <span className="line-clamp-2 wrap-anywhere text-left">
              {agendaNumber(a.position)} · {a.title}
            </span>
          </Button>
        ))}
      </nav>
      {writable && meeting.agenda.length > 0 && wide !== true && (
        <MinutesAgendaAdd submit={submit} />
      )}
    </div>
  )
}
export function MinutesAgendaNavigation({
  meeting,
  selectedId,
  writable,
  onSelect,
  submit,
}: Props) {
  const index = meeting.agenda.findIndex(a => a.id === selectedId)
  const wide = useMinutesWide()
  return (
    <Card className="hidden min-w-0 flex-col gap-4 p-4 sm:flex">
      <div>
        <h2 className="text-sm font-semibold">{T.agendas}</h2>
        {index >= 0 && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {agendaProgress(index, meeting.agenda.length)}
          </p>
        )}
      </div>
      <nav aria-label={T.agendas} className="flex min-w-0 flex-col gap-2">
        {meeting.agenda.map(a => (
          <Button
            key={a.id}
            variant="outline"
            touch
            aria-pressed={a.id === selectedId}
            className={`h-auto min-w-0 flex-col items-start gap-2 p-3 whitespace-normal ${a.id === selectedId ? 'border-blue-500 bg-blue-50' : ''}`}
            onClick={() => onSelect(a.id)}
          >
            <span className="text-xs text-muted-foreground tabular-nums">
              {agendaNumber(a.position)}
            </span>
            <span className="wrap-anywhere text-left text-sm">{a.title}</span>
            <span
              className={`text-right text-xs tabular-nums ${a.decisions.length ? 'text-muted-foreground' : 'text-gray-400'}`}
            >
              {decisionCount(a.decisions.length)}
              <span
                className={`ml-2 ${a.followUps.length ? 'text-muted-foreground' : 'text-gray-400'}`}
              >
                {followUpCount(a.followUps.length)}
              </span>
            </span>
          </Button>
        ))}
      </nav>
      {writable && meeting.agenda.length > 0 && wide !== false && (
        <MinutesAgendaAdd submit={submit} />
      )}
    </Card>
  )
}
export function MinutesParticipants({ meeting }: Pick<Props, 'meeting'>) {
  return (
    <Card className="min-w-0 p-4">
      <h2 className="mb-4 text-sm font-semibold">{T.participants}</h2>
      {meeting.attendees.length ? (
        <ul className="flex flex-col gap-3">
          {meeting.attendees.map(p => (
            <li key={p.id} className="wrap-anywhere text-sm">
              {p.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{T.emptyParticipants}</p>
      )}
    </Card>
  )
}
