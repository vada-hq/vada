import { createContext, type ReactNode } from 'react'
import { openEventTasks, openMenu, openMessageRoom, openRecord } from '@/lib/go-to'
import type { EventTab } from '@vada/contracts'
import type { Page } from '../../workspace/pages'
import type { S5Home } from './s5-data'
import S5Attention from './S5Attention'
import S5Events from './S5Events'
import { S5Finance, S5Finish, S5Greeting, S5Upcoming } from './S5Lists'
import HomeS7, { type S7Preview } from '../s7/HomeS7'
import {
  attentionMore,
  attentionRows,
  eventsTotal,
  financeRows,
  finishRows,
  upcomingShown,
  type AttentionRow,
} from './s5-view'

// 회장단 홈 S5 흑백 시안 A·B·C(notes/home-design-rules.md 3절). 미리보기(home-s5.html)에서만 쓴다. 지금 홈(CouncilHome)은 그대로다.
// B2는 10/29 내용 확정판(s7/HomeS7). A·B·C는 옛 내용으로 남긴다.
export type S5Variant = 'A' | 'B' | 'C' | 'B2'
export const HomeS5Preview = createContext<{ variant: S5Variant; data: S5Home; s7?: S7Preview } | null>(null)

type Props = {
  variant: S5Variant
  data: S5Home
  s7?: S7Preview | undefined
  councilId: string
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
}

function useOpeners({ councilId, onOpenEvent, onOpenPage }: Props) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId, { behind: 'home' })
  return {
    openTask,
    attention: (row: AttentionRow) => {
      if (row.target.kind === 'task' && row.target.id) openTask(row.target.id)
      else if (row.target.kind === 'request' && row.target.id)
        openRecord('purchases', councilId, row.target.id)
      else if (row.target.kind === 'purchases') openMenu('purchases', councilId, { view: 'pending' })
      else onOpenPage('people')
    },
    seeAttention: () =>
      openMenu('tasks', councilId, { tab: 'council', events: 'include', attention: 'true' }),
    eventTasks: (eventId: string, query: string) =>
      openEventTasks(councilId, eventId, query === 'overdue' ? { due: 'overdue' } : { assignee: 'none' }),
    seeEvents: () => onOpenPage('events'),
    finance: () => openMenu('finance', councilId),
    myTasks: () => openMenu('tasks', councilId, { tab: 'mine' }),
    calendar: () => openMenu('calendar', councilId),
    room: (roomId: string) => openMessageRoom(councilId, roomId),
    rooms: () => openMenu('chat', councilId),
    event: onOpenEvent,
  }
}

export default function HomeS5(props: Props) {
  if (props.s7)
    return (
      <HomeS7
        {...props.s7}
        councilId={props.councilId}
        pushBand={props.pushBand}
        onOpenEvent={eventId => props.onOpenEvent(eventId)}
        onOpenPage={props.onOpenPage}
        onNewEvent={props.onNewEvent}
      />
    )
  return <HomeS5Variants {...props} />
}

function HomeS5Variants(props: Props) {
  const { variant, data, pushBand, onNewEvent } = props
  const go = useOpeners(props)
  const rows = attentionRows(data)
  // D1: ①에 보인 업무는 ③ 내 업무의 '다음 마감'으로 다시 싣지 않는다.
  const shownTasks = new Set(rows.flatMap(row => (row.target.kind === 'task' && row.target.id ? [row.target.id] : [])))
  const wide = variant !== 'A'
  const attention = (
    <S5Attention
      rows={rows}
      more={attentionMore(data)}
      wide={wide}
      onOpen={go.attention}
      onSeeAll={go.seeAttention}
    />
  )
  const events = (
    <S5Events
      cards={data.board.events.cards}
      today={data.today}
      total={eventsTotal(data)}
      table={variant === 'C'}
      onOpenEvent={eventId => go.event(eventId)}
      onOpenTasks={go.eventTasks}
      onSeeAll={go.seeEvents}
      onNewEvent={data.board.canCreateEvent ? (onNewEvent ?? (() => {})) : undefined}
    />
  )
  const finishOpen = (row: { key: string }) =>
    row.key === 'my-tasks' ? go.myTasks() : row.key.startsWith('ev-') ? go.event(row.key) : go.calendar()
  const financeOpen = (row: { key: string }) =>
    row.key.startsWith('ev-') ? go.event(row.key, 'money') : go.finance()
  const upcomingOpen = (item: S5Home['upcoming']['items'][number]) => {
    if (item.kind === 'task_due') go.openTask(item.task.id)
    else if (item.kind === 'event_start') go.event(item.event.id)
    else if (item.kind === 'registration_close') go.event(item.event.id, 'registrations')
    else go.calendar()
  }
  const greeting = <S5Greeting home={data} onOpenRoom={go.room} onSeeRooms={go.rooms} />
  const finish = (className?: string) => (
    <S5Finish rows={finishRows(data, shownTasks)} className={className} onOpen={finishOpen} />
  )
  const finance = (className?: string) => (
    <S5Finance rows={financeRows(data)} className={className} onOpen={financeOpen} onSeeFinance={go.finance} />
  )
  const upcoming = (className?: string) => (
    <S5Upcoming
      home={data}
      dateColumn={wide}
      shown={upcomingShown}
      className={className}
      onOpen={upcomingOpen}
      onSeeAll={go.calendar}
    />
  )
  return (
    <div className="@container">
      <div className="flex flex-col gap-6 @2xl:gap-8" data-s5-variant={variant}>
        {pushBand}
        {greeting}
        {variant === 'A' ? (
          <>
            {events}
            <div className="grid gap-6 @2xl:grid-cols-3 @2xl:items-start @4xl:gap-8">
              {attention}
              {finish()}
              {upcoming()}
            </div>
            {finance()}
          </>
        ) : (
          <>
            {attention}
            {events}
            {/* 390은 ③ → ④ → ⑤(질문 차례), 넓으면 [③ | ⑤] 아래 ④ 가로 전체 */}
            <div className="grid gap-6 @2xl:grid-cols-2 @2xl:items-start @2xl:gap-y-8 @4xl:gap-8">
              {finish('@2xl:order-1')}
              {finance('@2xl:order-3 @2xl:col-span-2')}
              {upcoming('@2xl:order-2')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
