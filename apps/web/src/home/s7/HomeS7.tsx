import { useState, type ReactNode } from 'react'
import { openEventTasks, openMenu, openRecord } from '@/lib/go-to'
import type { Page } from '../../workspace/pages'
import type { S7Greeting, S7Home, S7WeekItem } from './s7-data'
import S7Attention from './S7Attention'
import S7Events from './S7Events'
import { S7Available, S7Greeting as Greeting, S7Todo, S7Week } from './S7Lists'
import { StartPanel, type StartAction } from './S7Start'
import { attentionRows, availableLine, dayLabel, todoRows, weekRows, type AttentionRow, type TodoRow } from './s7-view'

// 회장단 홈 B2 시안(10/29 내용 확정판, notes/home-design-rules.md 2·3절). 미리보기(home-s5.html?variant=B2)에서만 쓴다.
// 차례: 머리(날짜) → ① → ② → ③ → ⑤ → 사용 가능 한 줄. 넓으면 ①·② 가로 전체, [③ | ⑤] 2열.

export type S7Preview = { data: S7Home; greeting: S7Greeting }

type Props = S7Preview & {
  councilId: string
  pushBand?: ReactNode
  onOpenEvent: (eventId: string) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
}

function useOpeners({ councilId, onOpenEvent, onOpenPage }: Props) {
  return {
    attention: (row: AttentionRow) => {
      if (row.target === 'task') openRecord('tasks', councilId, row.key, { behind: 'home' })
      else if (row.target === 'request') openRecord('purchases', councilId, row.key)
      else if (row.target === 'tasks-no-department') openMenu('tasks', councilId, { tab: 'council' })
      else onOpenPage('people')
    },
    seeAttention: () => openMenu('tasks', councilId, { tab: 'council', events: 'include', attention: 'true' }),
    late: (eventId: string) => openEventTasks(councilId, eventId, { due: 'overdue' }),
    todo: (row: TodoRow) => (row.key === 'available' ? openMenu('finance', councilId) : openMenu('tasks', councilId, { tab: 'mine' })),
    week: () => openMenu('calendar', councilId),
    finance: () => openMenu('finance', councilId),
    events: () => onOpenPage('events'),
    event: onOpenEvent,
  }
}

export default function HomeS7(props: Props) {
  const { data, greeting, pushBand, onNewEvent } = props
  const go = useOpeners(props)
  const [action, setAction] = useState<StartAction | null>(null)
  const attention = attentionRows(data)
  const calm = attention.total === 0
  const available = availableLine(data)
  const askRow = (row: AttentionRow) =>
    row.ask && setAction({ kind: 'ask', to: row.ask.to, attach: row.ask.attach, marker: row.marker, asked: row.ask.asked })
  const askTodo = (row: TodoRow) =>
    row.settlement &&
    setAction({
      kind: 'ask',
      to: row.settlement.ask.to,
      attach: `${row.settlement.ask.attach} 정산`,
      marker: '정산 남음',
      asked: row.settlement.ask.asked,
    })
  const agenda = (item: S7WeekItem) => setAction({ kind: 'agenda', meeting: item.title, date: dayLabel(item.date) })
  return (
    <div className="@container">
      <div className="flex flex-col gap-6 @2xl:gap-8" data-s5-variant="B2" data-s7-greeting={greeting}>
        {pushBand}
        <Greeting today={data.today} name={data.name} greeting={greeting} calm={calm} />
        {!(calm && greeting === 'merge') && (
          <S7Attention
            rows={attention.rows}
            total={attention.total}
            more={attention.more}
            onOpen={go.attention}
            onAsk={askRow}
            onSeeAll={go.seeAttention}
          />
        )}
        <S7Events
          cards={data.events.cards}
          today={data.today}
          total={data.events.total}
          onOpenEvent={go.event}
          onOpenLate={go.late}
          onPurchase={card => setAction({ kind: 'purchase', eventName: card.name })}
          onSeeAll={go.events}
          onNewEvent={data.events.canCreate ? (onNewEvent ?? (() => {})) : undefined}
        />
        <div className="grid gap-6 @2xl:grid-cols-2 @2xl:items-start @4xl:gap-8">
          <S7Todo rows={todoRows(data)} onOpen={go.todo} onAsk={askTodo} />
          <S7Week rows={weekRows(data)} onOpen={go.week} onAgenda={agenda} />
        </div>
        {available && <S7Available amount={available} onSeeFinance={go.finance} />}
      </div>
      <StartPanel action={action} onClose={() => setAction(null)} />
    </div>
  )
}
