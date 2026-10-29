import { CalendarCheck2, FileUp, Landmark, Plus, Users, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TEXT_SUB } from '../c1r/f8/tokens'
import { WEEK_TITLE, dateText, type WeekItem } from './c35-data'
import type { WeekProps } from './WeekA'
import {
  AGENDA_BUTTON,
  BAND,
  BAND_DOT,
  BAND_HEAD,
  BAND_STACK,
  TEXT_ITEM,
  TEXT_QUIET_HEAD,
  TEXT_SMALL,
} from './tokens'

// ⑤ 이번 주 안 b(①f8 가족): 일정마다 f8 0건 띠와 같은 회색 띠 한 줄(흰 원 + 글). 흰 묶음 없이 띠만 쌓는다.
// 띠 = 흰 원 아이콘(회의 / 외부 / 제출 마감) | 제목 · '11월 2일 (월) 19:00' · 안건 3 또는 라벨 | 회의의 [안건 올리기].
// 0건이면 '이번 주 일정 없음' 띠 한 줄(안 a는 숨긴다).

const HEAD_ID = 'c35-week-b-head'

const iconOf = (item: WeekItem): LucideIcon =>
  item.kind === 'meeting' ? Users : item.label === '외부' ? Landmark : FileUp

const whenOf = (item: WeekItem) => [dateText(item.date), item.time].filter(Boolean).join(' ')
const restOf = (item: WeekItem) => (item.kind === 'meeting' ? `안건 ${item.agenda}` : item.label)

function Dot({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-secondary',
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
    </span>
  )
}

function Band({ item, onOpen, onAgenda }: { item: WeekItem } & Omit<WeekProps, 'items'>) {
  return (
    <li
      data-c35-row={item.id}
      className={cn('relative flex items-center hover:bg-surface-subtle', BAND)}
    >
      <Dot icon={iconOf(item)} className={BAND_DOT} />
      <div className="min-w-0 flex-1 py-1.5 @2xl:flex @2xl:items-baseline @2xl:gap-2">
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
        <p className={cn('min-w-0 text-fg-tertiary', TEXT_SMALL)}>
          <span className="whitespace-nowrap text-fg-secondary">{whenOf(item)}</span>
          <span aria-hidden> · </span>
          <span className="whitespace-nowrap">{restOf(item)}</span>
        </p>
      </div>
      {item.kind === 'meeting' && (
        <Button
          variant="link"
          className={cn(AGENDA_BUTTON, TEXT_SMALL)}
          onClick={() => onAgenda(item)}
        >
          <Plus aria-hidden />
          안건 올리기
        </Button>
      )}
    </li>
  )
}

function Empty() {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', BAND)}>
      <Dot icon={CalendarCheck2} className={BAND_DOT} />
      <h2 id={HEAD_ID} className={cn('min-w-0 font-medium text-fg-secondary', TEXT_SUB)}>
        {`${WEEK_TITLE} 일정 없음`}
      </h2>
    </section>
  )
}

export default function WeekB({ items, onOpen, onAgenda }: WeekProps) {
  if (items.length === 0) return <Empty />
  return (
    <section aria-labelledby={HEAD_ID}>
      <h2 id={HEAD_ID} className={cn('text-fg-secondary', BAND_HEAD, TEXT_QUIET_HEAD)}>
        {WEEK_TITLE}
      </h2>
      <ul className={cn('flex flex-col', BAND_STACK)}>
        {items.map(item => (
          <Band key={item.id} item={item} onOpen={onOpen} onAgenda={onAgenda} />
        ))}
      </ul>
    </section>
  )
}
