import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WEEK_TITLE, dateText, dayParts, type WeekItem } from './c35-data'
import {
  AGENDA_BUTTON,
  DATE_CELL,
  DATE_DAY,
  DATE_WEEKDAY,
  LABEL_PILL,
  TEXT_ITEM,
  TEXT_QUIET_HEAD,
  TEXT_SMALL,
  WEEK_GROUP,
  WEEK_HEAD,
  WEEK_ROW,
  WEEK_TRAY,
} from './tokens'

// ⑤ 이번 주 안 a(②e3 가족): ①②③과 같은 회색 쟁반 + 흰 묶음을 한 단계 작게, 줄 앞에 e3 날짜 머리(요일 위·날짜 숫자 아래) 칸.
// 줄 = 날짜 칸 | 제목 + 시각·안건 | 오른쪽 라벨 알약(외부·제출 마감) 또는 회의의 [안건 올리기].
// 0건이면 구역을 숨긴다(안 b는 한 줄 띠로 둔다: 명세 2절 '두 안 중 하나씩 시험').

export type WeekProps = {
  items: WeekItem[]
  onOpen: (item: WeekItem) => void
  onAgenda: (item: WeekItem) => void
}

const HEAD_ID = 'c35-week-a-head'

function DateCell({ date }: { date: string }) {
  const { weekday, date: day, month } = dayParts(date)
  return (
    <span className={cn('flex shrink-0 flex-col items-center', DATE_CELL)}>
      <span aria-hidden className={cn('text-fg-muted', DATE_WEEKDAY)}>
        {day === 1 ? `${month}월` : weekday}
      </span>
      <span aria-hidden className={cn('font-semibold text-fg tabular-nums', DATE_DAY)}>
        {day}
      </span>
      <span className="sr-only">{dateText(date)}</span>
    </span>
  )
}

const subOf = (item: WeekItem) =>
  item.kind === 'meeting' ? `${item.time} · 안건 ${item.agenda}` : item.time

function Row({ item, onOpen, onAgenda }: { item: WeekItem } & Omit<WeekProps, 'items'>) {
  const sub = subOf(item)
  return (
    <li data-c35-row={item.id} className={cn('relative flex items-center', WEEK_ROW)}>
      <DateCell date={item.date} />
      <div className="min-w-0 flex-1 @2xl:flex @2xl:items-baseline @2xl:gap-2.5">
        <Button
          variant="link"
          className={cn(
            'h-auto max-w-full min-w-0 justify-start border-0 p-0 text-left whitespace-normal text-fg after:absolute after:inset-0 hover:no-underline',
            TEXT_ITEM,
          )}
          onClick={() => onOpen(item)}
        >
          <span className="line-clamp-1 break-keep wrap-anywhere">{item.title}</span>
        </Button>
        {sub && <p className={cn('shrink-0 text-fg-tertiary tabular-nums', TEXT_SMALL)}>{sub}</p>}
      </div>
      {item.kind === 'meeting' ? (
        <Button
          variant="link"
          className={cn(AGENDA_BUTTON, TEXT_SMALL)}
          onClick={() => onAgenda(item)}
        >
          <Plus aria-hidden />
          안건 올리기
        </Button>
      ) : (
        <span
          className={cn(
            'inline-flex shrink-0 items-center font-medium text-fg-secondary',
            LABEL_PILL,
            TEXT_SMALL,
          )}
        >
          {item.label}
        </span>
      )}
    </li>
  )
}

export default function WeekA({ items, onOpen, onAgenda }: WeekProps) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={HEAD_ID} className={WEEK_TRAY}>
      <h2 id={HEAD_ID} className={cn('text-fg-secondary', WEEK_HEAD, TEXT_QUIET_HEAD)}>
        {WEEK_TITLE}
      </h2>
      <ul className={WEEK_GROUP}>
        {items.map(item => (
          <Row key={item.id} item={item} onOpen={onOpen} onAgenda={onAgenda} />
        ))}
      </ul>
    </section>
  )
}
