import { cn } from '@/lib/utils'
import { Empty, M, MP, R, RowTitle, Section, TextLink, WRAP, listClass, rowClass } from '../s5/S5Parts'
import { StartButton } from './S7Start'
import type { S7Greeting, S7WeekItem } from './s7-data'
import { askedText, dayLabel, type TodoRow } from './s7-view'

export const GREETING_ID = 's7-greeting'
export const TODO_ID = 's7-todo'
export const WEEK_ID = 's7-week'
export const AVAILABLE_ID = 's7-available'

// 머리(1.7): 상자 없는 한 줄. 날짜는 D-day의 기준이라 늘 둔다. 인사는 시안 값에 따라.
// merge이고 ①이 비었으면 인사와 '확인할 일 없음'을 한 문장으로 합친다(① 상자 대신).
export function S7Greeting({
  today,
  name,
  greeting,
  calm,
}: {
  today: string
  name: string
  greeting: S7Greeting
  calm: boolean
}) {
  const line =
    greeting === 'date' ? null : greeting === 'merge' && calm ? `${name}님, 오늘은 확인할 일 없어요` : `${name}님, 안녕하세요`
  return (
    <section aria-labelledby={GREETING_ID} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <h2 id={GREETING_ID} className={cn(M, 'font-normal')}>
        {dayLabel(today)}
      </h2>
      {line && <p className={cn(R, WRAP)}>{line}</p>}
    </section>
  )
}

function TodoItem({
  row,
  onOpen,
  onAsk,
}: {
  row: TodoRow
  onOpen: () => void
  onAsk: () => void
}) {
  const settle = row.settlement
  return (
    <li className={cn(rowClass, 'flex flex-col gap-1')}>
      <RowTitle onClick={onOpen}>{row.title}</RowTitle>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex flex-wrap gap-x-2">
          {row.note && <span className={cn(MP, 'tabular-nums')}>{row.note}</span>}
          {row.meta && <span className={cn(M, WRAP)}>{row.meta}</span>}
        </p>
        {/* 끝난 행사의 정산 남음은 같은 줄 안에(두 줄로 싣지 않는다, D4) */}
        {settle && (
          <p className="flex items-center gap-2">
            <span className={M}>{settle.text}</span>
            {settle.ask.asked ? (
              <span className={M}>{`${askedText(settle.ask.asked)} ${settle.ask.asked.answered ? '답 있음' : '답 없음'}`}</span>
            ) : (
              <StartButton label="묻기" onClick={onAsk} />
            )}
          </p>
        )}
      </div>
    </li>
  )
}

export function S7Todo({
  rows,
  className,
  onOpen,
  onAsk,
}: {
  rows: TodoRow[]
  className?: string
  onOpen: (row: TodoRow) => void
  onAsk: (row: TodoRow) => void
}) {
  return (
    <Section id={TODO_ID} title="내가 할 일" className={className}>
      {rows.length === 0 ? (
        <Empty>내가 할 일 없음</Empty>
      ) : (
        <ul className={listClass}>
          {rows.map(row => (
            <TodoItem key={row.key} row={row} onOpen={() => onOpen(row)} onAsk={() => onAsk(row)} />
          ))}
        </ul>
      )}
    </Section>
  )
}

type WeekRow = { item: S7WeekItem; date: string; time: string | null; meta: string }

export function S7Week({
  rows,
  className,
  onOpen,
  onAgenda,
}: {
  rows: WeekRow[]
  className?: string
  onOpen: (item: S7WeekItem) => void
  onAgenda: (item: S7WeekItem) => void
}) {
  return (
    <Section id={WEEK_ID} title="이번 주" className={className}>
      {rows.length === 0 ? (
        <Empty>7일 안 일정 없음</Empty>
      ) : (
        <ul className={listClass}>
          {rows.map(row => (
            <li key={row.item.id} className={cn(rowClass, 'flex flex-col gap-1 @2xl:flex-row @2xl:items-center @2xl:gap-4')}>
              <span className={cn(M, 'tabular-nums @2xl:flex @2xl:w-24 @2xl:shrink-0 @2xl:flex-col')}>
                <span>{row.date}</span>
                {row.time && <span>{` ${row.time}`}</span>}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <span className="flex min-w-0 flex-col gap-1">
                  <RowTitle onClick={() => onOpen(row.item)}>{row.item.title}</RowTitle>
                  <span className={cn(M, WRAP)}>{row.meta}</span>
                </span>
                {row.item.kind === 'meeting' && <StartButton label="안건 올리기" onClick={() => onAgenda(row.item)} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// 끝 한 줄: 머리글·상자 없이 '사용 가능 920,000원 · 재정 보기'. 음수면 이 줄 대신 ③(D5).
export function S7Available({ amount, onSeeFinance }: { amount: string; onSeeFinance: () => void }) {
  return (
    <section aria-labelledby={AVAILABLE_ID} className="flex flex-wrap items-baseline gap-x-2">
      <h2 id={AVAILABLE_ID} className={cn(M, 'font-normal')}>
        사용 가능
      </h2>
      <p className={cn(R, 'tabular-nums')}>{amount}</p>
      <TextLink onClick={onSeeFinance}>재정 보기</TextLink>
    </section>
  )
}
