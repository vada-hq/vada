import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { groupsOf, type C1rGroup } from './groups'
import { DateHead, Row } from './parts'
import {
  AXIS_FROM_DOT,
  AXIS_TO_DOT,
  AXIS_X,
  BODY_INSET,
  DOT,
  DOT_X,
  DOT_Y,
  HEAD_COL,
  ROWS_INSET,
  SECTION_TITLE,
  SHELL_RADIUS,
  SMALL,
} from './tokens'

// f6: 날짜 머리 축(형태 바, 레퍼런스 f14 Things 다가오는 일·f15 Todoist 다가오는 일·f16 Flighty 늦음).
// 줄을 날짜 머리 아래에 둔다. 머리는 큰 날짜 숫자 + 요일 + 사실을 한 번만 말하고, 줄에는 일과 사람만 남는다.
// 977·716은 머리를 왼쪽 칸에 세로로 세우고 그 오른쪽에 세로 축 선과 점을 둬 시간 축처럼, 358은 축 선이 맨 왼쪽으로 가고
// 머리가 줄 위로 올라간다. 0건이면 머리 한 줄만.

const HEAD_ID = 'c1r-f6-head'

function SeeAll({
  total,
  onSeeAll,
  className,
}: {
  total: number
  onSeeAll: () => void
  className?: string
}) {
  return (
    <Button
      variant="link"
      className={cn('h-auto gap-0.5 p-0 font-medium text-primary-strong', SMALL, className)}
      onClick={onSeeAll}
    >
      {`전체 ${total}건 보기`}
      <ChevronRight />
    </Button>
  )
}

function Head({ total, onSeeAll }: { total: number; onSeeAll: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {total === 0 && (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-fg-tertiary"
        >
          <Check className="size-4" strokeWidth={2.5} />
        </span>
      )}
      <h2
        id={HEAD_ID}
        className={cn(SECTION_TITLE, 'min-w-0 font-bold text-fg break-keep wrap-anywhere')}
      >
        {C1R_TITLE}
      </h2>
      {total === 0 ? (
        <span className={cn(SMALL, 'ml-auto text-fg-muted')}>없음</span>
      ) : (
        <span
          aria-label={`${total}건`}
          className={cn(
            SMALL,
            'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-2 font-semibold text-fg-secondary tabular-nums',
          )}
        >
          {total}
        </span>
      )}
      {total > C1R_SHOWN && (
        <SeeAll
          total={total}
          onSeeAll={onSeeAll}
          className={cn('ml-auto hidden @2xl:inline-flex', headLinkTouch)}
        />
      )}
    </div>
  )
}

// 축 점: 지난 날은 채운 회색, 오늘은 진한 점 + 바탕 고리, 다가올 날은 빈 원, 기한 없음은 옅은 점.
function Dot({ group }: { group: C1rGroup }) {
  const rel = group.date?.rel ?? 'none'
  return (
    <span
      aria-hidden
      className={cn(
        'absolute rounded-full',
        DOT,
        DOT_X,
        DOT_Y,
        rel === 'past' && 'bg-fg-muted',
        rel === 'today' && 'bg-fg ring-4 ring-card',
        rel === 'future' && 'border-2 border-fg-muted bg-card',
        rel === 'none' && 'bg-input',
      )}
    />
  )
}

type Actions = Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>

function Group({
  group,
  first,
  last,
  actions,
}: {
  group: C1rGroup
  first: boolean
  last: boolean
  actions: Actions
}) {
  return (
    <li
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)] pt-1 pb-1.5 @2xl:py-2',
        HEAD_COL,
        BODY_INSET,
      )}
    >
      {/* 축 선: 첫 묶음은 점에서 시작, 마지막 묶음은 점에서 끝 */}
      <span
        aria-hidden
        className={cn(
          'absolute w-px bg-border',
          AXIS_X,
          first ? AXIS_FROM_DOT : 'top-0',
          last ? AXIS_TO_DOT : 'bottom-0',
          first && last && 'hidden',
        )}
      />
      <Dot group={group} />
      <div className="pt-1.5 @2xl:pt-2">
        <DateHead group={group} />
      </div>
      <ul className={cn('flex flex-col', ROWS_INSET)}>
        {group.rows.map(row => (
          <Row key={row.id} row={row} showFact={group.fact === null} {...actions} />
        ))}
      </ul>
    </li>
  )
}

export default function C1rF6({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const groups = groupsOf(data.rows.slice(0, C1R_SHOWN))
  const more = data.total > C1R_SHOWN
  const actions = { onOpen, onAsk, onOpenAsked, onAssign }
  return (
    <section
      aria-labelledby={HEAD_ID}
      className={cn(
        'border border-border bg-card text-card-foreground',
        SHELL_RADIUS,
        data.total === 0 ? 'px-5 py-3.5' : 'px-5 pt-4 pb-3 max-sm:px-4',
      )}
    >
      <Head total={data.total} onSeeAll={onSeeAll} />
      {groups.length > 0 && (
        <ul className="mt-2">
          {groups.map((group, i) => (
            <Group
              key={group.key}
              group={group}
              first={i === 0}
              last={i === groups.length - 1}
              actions={actions}
            />
          ))}
        </ul>
      )}
      {more && (
        <div className="flex justify-center border-t border-border-subtle @2xl:hidden">
          <SeeAll total={data.total} onSeeAll={onSeeAll} className="min-h-11 w-full" />
        </div>
      )}
    </section>
  )
}
