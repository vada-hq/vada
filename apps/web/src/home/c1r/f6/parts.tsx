import type { ReactNode } from 'react'
import { ChevronRight, MessageCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { THIS_MONTH, type C1rGroup } from './groups'
import { AVATAR, AVATAR_TONES, DATE_NUMBER, ROW_RADIUS, ROW_TITLE, SMALL } from './tokens'

const WRAP = 'break-keep wrap-anywhere'
// 머리글자 원에 이름 뒤 두 글자(성 빼고)
const INITIALS = 2

// 날짜 머리: 큰 날짜 숫자 + 요일, 그 아래(358은 옆) 사실. 977·716은 왼쪽 칸에 세로로, 358은 줄 위 한 줄.
export function DateHead({ group }: { group: C1rGroup }) {
  const { date, fact, danger } = group
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 @2xl:block">
      {date ? (
        <p className="flex items-baseline gap-1.5">
          {date.month !== THIS_MONTH && (
            <span className={cn(SMALL, 'font-medium text-fg-muted')}>{`${date.month}월`}</span>
          )}
          <span
            className={cn(DATE_NUMBER, 'font-semibold tracking-[-0.02em] text-fg tabular-nums')}
          >
            {date.day}
          </span>
          <span className={cn(SMALL, 'font-medium text-fg-muted')}>{date.week}</span>
        </p>
      ) : (
        <p className={cn(DATE_NUMBER, 'flex items-center')}>
          <span className={cn(SMALL, 'font-semibold text-fg-secondary')}>기한 없음</span>
        </p>
      )}
      {fact && (
        <p
          className={cn(
            SMALL,
            'font-semibold @2xl:mt-0.5',
            danger ? 'text-danger' : 'text-fg-secondary',
          )}
        >
          {fact}
        </p>
      )}
    </div>
  )
}

function toneOf(name: string) {
  let n = 0
  for (const ch of name) n += ch.codePointAt(0) ?? 0
  return AVATAR_TONES[n % AVATAR_TONES.length]
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        AVATAR,
        toneOf(name),
      )}
    >
      {name.slice(-INITIALS)}
    </span>
  )
}

// 사람 = 묻기. 머리글자 원 + 이름·역할 + 말풍선. 테두리 없는 글 단추라 줄마다 버튼 상자가 반복되지 않는다.
function Person({ row, onAsk }: { row: C1rRow; onAsk: C1rProps['onAsk'] }) {
  if (!row.person) {
    return (
      <span className={cn(SMALL, 'flex items-center gap-2 text-fg-secondary')}>
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-muted text-fg-tertiary',
            AVATAR,
          )}
        >
          <Users className="size-3.5" />
        </span>
        {row.contact}
      </span>
    )
  }
  return (
    <Button
      variant="link"
      className={cn(
        'relative z-10 h-auto gap-2 p-0 font-medium text-fg-secondary hover:text-fg hover:no-underline',
        SMALL,
        headLinkTouch,
      )}
      aria-label={`${row.contact}에게 묻기`}
      onClick={() => onAsk(row)}
    >
      <Avatar name={row.person.name} />
      <span className="whitespace-nowrap">{row.contact}</span>
      <MessageCircle aria-hidden className="size-3.5! text-primary-strong" />
    </Button>
  )
}

// 둘째 줄: (358만) 사람 + 머리에 없는 사실(기한 없음 묶음) + 물어본 상태 링크 또는 행사 + (358 배정 줄) 배정하기
function Meta({
  row,
  showFact,
  lead,
  tail,
  onOpenAsked,
}: {
  row: C1rRow
  showFact: boolean
  lead: ReactNode
  tail: ReactNode
  onOpenAsked: C1rProps['onOpenAsked']
}) {
  const fact = showFact && (
    <span
      className={cn('shrink-0 font-semibold', row.danger ? 'text-danger' : 'text-fg-secondary')}
    >
      {row.fact}
    </span>
  )
  const rest = row.askedText ? (
    <Button
      variant="link"
      className={cn(
        'relative z-10 h-auto min-w-0 p-0 font-normal text-fg-tertiary underline decoration-border underline-offset-4 hover:decoration-fg-tertiary',
        SMALL,
        headLinkTouch,
      )}
      onClick={() => onOpenAsked(row)}
    >
      {row.askedText}
    </Button>
  ) : (
    row.event && <span className="min-w-0 truncate text-fg-muted">{row.event}</span>
  )
  return (
    <div
      className={cn(
        SMALL,
        'mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 @2xl:mt-0.5 @2xl:flex-nowrap @2xl:gap-x-2',
        !fact && !rest && '@2xl:hidden',
      )}
    >
      <span className="contents @2xl:hidden">{lead}</span>
      {fact}
      {rest}
      <span className="ml-auto contents @2xl:hidden">{tail}</span>
    </div>
  )
}

type RowProps = { row: C1rRow; showFact: boolean } & Pick<
  C1rProps,
  'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'
>

function AssignLabel() {
  return (
    <span
      className={cn(SMALL, 'ml-auto flex items-center gap-0.5 font-medium text-primary-strong')}
    >
      배정하기
      <ChevronRight aria-hidden className="size-3.5" />
    </span>
  )
}

// 줄: 일(제목 + 행사·물어봄) 왼쪽, 사람 오른쪽(358은 제목 아래 한 줄에 사람과 행사·물어봄). 줄 전체가 일 보기(배정 줄은 배정하기).
export function Row({ row, showFact, onOpen, onAsk, onOpenAsked, onAssign }: RowProps) {
  const assign = row.person === null
  const person = <Person row={row} onAsk={onAsk} />
  const label = assign && <AssignLabel />
  return (
    <li
      className={cn(
        '-mx-3 flex items-center gap-4 px-3 py-2 transition-colors hover:bg-surface-subtle @2xl:py-2.5',
        ROW_RADIUS,
        rowLinkBox,
      )}
    >
      <div className="min-w-0 flex-1">
        <Button
          variant="link"
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left font-semibold whitespace-normal text-fg hover:no-underline',
            ROW_TITLE,
            rowLinkTarget,
          )}
          aria-label={assign ? `${row.title} 배정하기` : undefined}
          onClick={() => (assign ? onAssign(row) : onOpen(row))}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </Button>
        <Meta row={row} showFact={showFact} lead={person} tail={label} onOpenAsked={onOpenAsked} />
      </div>
      <div className="hidden shrink-0 items-center gap-3 @2xl:flex">
        {person}
        {label}
      </div>
    </li>
  )
}
