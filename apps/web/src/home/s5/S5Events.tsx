import { Meter } from '@/components/Meter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { S5BoardEvent } from './s5-data'
import { M, MP, R, RowTitle, Section, TextLink, WRAP, listClass, rowClass } from './S5Parts'
import { eventNext, eventRisks, eventStatus, eventWhen } from './s5-view'

// ② 전체 행사 진행 현황. A·B는 세로 구분선으로 나눈 3칸, C는 같은 기준선의 줄 목록이다(3절).

type Open = {
  onOpenEvent: (eventId: string) => void
  onOpenTasks: (eventId: string, query: string) => void
}
type Props = Open & {
  cards: S5BoardEvent[]
  today: string
  total: number
  table: boolean
  onSeeAll: () => void
  onNewEvent?: (() => void) | undefined
}

// 위험 신호: 0 아닌 수만 진한 글자(M+), 둘 다 0이면 '확인 필요 없음'(M). 색·아이콘 없음(X5).
// 글자를 누르면 그 행사 업무를 그 갈래로 거른다(줄 링크 위의 따로 누르는 링크).
function Risks({ card, separator, onOpenTasks }: { card: S5BoardEvent; separator: string } & Pick<Open, 'onOpenTasks'>) {
  const risks = eventRisks(card)
  if (risks.length === 0) return <span className={M}>확인 필요 없음</span>
  return (
    <span className={WRAP}>
      {risks.map((risk, index) => (
        <span key={risk.query}>
          {index > 0 && <span className={MP}>{separator}</span>}
          <Button
            variant="link"
            className={cn(MP, 'relative z-10 inline h-auto gap-1 p-0')}
            onClick={() => onOpenTasks(card.event.id, risk.query)}
          >
            {risk.label}
          </Button>
        </span>
      ))}
    </span>
  )
}

function Cell({ card, today, ...open }: Open & { card: S5BoardEvent; today: string }) {
  const when = eventWhen(card, today)
  const next = eventNext(card)
  return (
    <li
      className={cn(
        rowClass,
        'flex min-w-0 flex-1 flex-col gap-2 @2xl:py-0 @2xl:pr-4 @2xl:pl-4 @2xl:first:pl-0 @2xl:last:pr-0',
      )}
    >
      <div className="flex flex-col gap-1">
        <span className={M}>{eventStatus(card)}</span>
        <RowTitle onClick={() => open.onOpenEvent(card.event.id)}>{card.event.name}</RowTitle>
        <span className={M}>{when.d ? `${when.date} · ${when.d}` : when.date}</span>
      </div>
      <div className="flex items-center gap-2">
        <Meter
          value={card.tasks.done}
          max={Math.max(card.tasks.total, 1)}
          label={`업무 ${card.tasks.done}/${card.tasks.total}`}
          className="h-1 w-24 shrink-0 [&::-moz-progress-bar]:bg-gray-700 [&::-webkit-progress-value]:bg-gray-700"
        />
        <span className={M}>업무</span>
        <span className={cn(R, 'tabular-nums')}>{`${card.tasks.done}/${card.tasks.total}`}</span>
      </div>
      <Risks card={card} separator=" · " onOpenTasks={open.onOpenTasks} />
      {next && <p className={cn(M, WRAP)}>{`다음 마감 ${next}`}</p>}
    </li>
  )
}

// C 넓은 폭: 열 폭(1280 / 1024). 모든 줄과 열 이름 줄이 같은 폭을 쓴다.
const COL = {
  name: 'min-w-0 flex-1',
  status: 'w-16 shrink-0 @4xl:w-18',
  d: 'w-24 shrink-0 text-right @4xl:w-28',
  tasks: 'w-12 shrink-0 text-right @4xl:w-14',
  risk: 'w-32 shrink-0 @4xl:w-40',
  next: 'min-w-0 flex-1',
}
const TABLE_ROW = 'flex items-baseline gap-3 @4xl:gap-4'

function DCell({ card, today, wide }: { card: S5BoardEvent; today: string; wide: boolean }) {
  const when = eventWhen(card, today)
  if (when.d) return <span className={cn(R, 'tabular-nums')}>{when.d}</span>
  return <span className={cn(M, WRAP, !wide && 'text-right')}>{when.date}</span>
}

function TableRow({ card, today, ...open }: Open & { card: S5BoardEvent; today: string }) {
  const next = eventNext(card)
  return (
    <li className={cn(rowClass, TABLE_ROW)}>
      <span className={COL.name}>
        <RowTitle onClick={() => open.onOpenEvent(card.event.id)}>{card.event.name}</RowTitle>
      </span>
      <span className={cn(M, COL.status)}>{eventStatus(card)}</span>
      <span className={COL.d}>
        <DCell card={card} today={today} wide />
      </span>
      <span className={cn(R, 'tabular-nums', COL.tasks)}>
        {`${card.tasks.done}/${card.tasks.total}`}
      </span>
      <span className={COL.risk}>
        <Risks card={card} separator=", " onOpenTasks={open.onOpenTasks} />
      </span>
      <span className={cn(M, WRAP, COL.next)}>{next}</span>
    </li>
  )
}

// C 390: 줄마다 3줄. 1행 행사명 + D-day, 2행 '{상태} · {위험}', 3행 다음 마감
function StackRow({ card, today, ...open }: Open & { card: S5BoardEvent; today: string }) {
  const next = eventNext(card)
  return (
    <li className={cn(rowClass, 'flex flex-col gap-1')}>
      <div className="flex items-baseline justify-between gap-4">
        <RowTitle onClick={() => open.onOpenEvent(card.event.id)}>{card.event.name}</RowTitle>
        <span className="shrink-0">
          <DCell card={card} today={today} wide={false} />
        </span>
      </div>
      <p>
        <span className={M}>{`${eventStatus(card)} · `}</span>
        <Risks card={card} separator=", " onOpenTasks={open.onOpenTasks} />
      </p>
      {next && <p className={cn(M, WRAP)}>{`다음 마감 ${next}`}</p>}
    </li>
  )
}

function Table({ cards, today, ...open }: Open & { cards: S5BoardEvent[]; today: string }) {
  return (
    <>
      <ul className={cn(listClass, '@2xl:hidden')}>
        {cards.map(card => (
          <StackRow key={card.event.id} card={card} today={today} {...open} />
        ))}
      </ul>
      <div className="hidden @2xl:block">
        <div aria-hidden className={cn(M, TABLE_ROW, 'pb-2')}>
          <span className={COL.name}>행사</span>
          <span className={COL.status}>상태</span>
          <span className={COL.d}>D-day</span>
          <span className={COL.tasks}>업무</span>
          <span className={COL.risk}>위험 신호</span>
          <span className={COL.next}>다음 마감</span>
        </div>
        <ul className={cn(listClass, 'border-t border-gray-200')}>
          {cards.map(card => (
            <TableRow key={card.event.id} card={card} today={today} {...open} />
          ))}
        </ul>
      </div>
    </>
  )
}

export default function S5Events({ cards, today, total, table, onSeeAll, onNewEvent, ...open }: Props) {
  const right = total > 0 && <TextLink onClick={onSeeAll}>{`전체 ${total}개 보기`}</TextLink>
  return (
    <Section id="s5-events" title="전체 행사 진행 현황" right={right}>
      {cards.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4 py-3">
          <p className={M}>진행할 행사 없음</p>
          {onNewEvent && (
            <Button className="gap-2 bg-gray-900 text-sm font-medium text-white hover:bg-gray-700" onClick={onNewEvent}>
              새 행사
            </Button>
          )}
        </div>
      ) : table ? (
        <Table cards={cards} today={today} {...open} />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 @2xl:flex-row @2xl:divide-x @2xl:divide-y-0">
          {cards.map(card => (
            <Cell key={card.event.id} card={card} today={today} {...open} />
          ))}
        </ul>
      )}
    </Section>
  )
}
