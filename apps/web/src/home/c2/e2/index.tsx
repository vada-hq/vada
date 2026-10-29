import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C2_EMPTY, C2_SHOWN, C2_TITLE } from '../c2-data'
import type { C2Props } from '../c2-props'
import { EventRow } from './EventRow'
import { GROUP, QUIET, QUIET_DOT, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// e2: 왼쪽 날짜 칸(c2-refs 나 절). ①(f8)과 같은 회색 쟁반 위 흰 묶음에 행사 줄을 다음 일정이 가까운 차례로 세운다.
// 줄 왼쪽은 글자로만 세운 달력 조각(월 / 날짜 / 요일), 칸과 칸은 가는 세로 레일로 이어 '다가오는 차례'를 보인다.
// 오른쪽은 이름 + 'D-2 신청 마감'(남은 날 굵게), 신호는 716·977에서 줄 오른쪽, 358에서 이름 아래.

const HEAD_ID = 'c2-e2-head'

// 0개: ①의 0건 띠와 같은 회색 띠 한 줄. 만들 권한이 있으면 끝에 [새 행사].
function Empty({ canCreate, onCreate }: Pick<C2Props, 'onCreate'> & { canCreate: boolean }) {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', QUIET)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          QUIET_DOT,
        )}
      >
        <CalendarDays className="size-4.5" strokeWidth={2.25} />
      </span>
      <h2 id={HEAD_ID} className={cn('min-w-0 flex-1 font-medium text-fg-secondary', TEXT_SUB)}>
        {C2_EMPTY}
      </h2>
      {canCreate && (
        <Button
          variant="link"
          className={cn(
            'h-auto min-h-11 gap-1 rounded-full border-0 px-3 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4.5',
            TEXT_SUB,
          )}
          onClick={onCreate}
        >
          <Plus aria-hidden strokeWidth={2.25} />새 행사
        </Button>
      )}
    </section>
  )
}

function SeeAll({ total, onSeeAll }: { total: number; onSeeAll: () => void }) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'group/all h-auto w-full rounded-2xl border-0 px-3 py-2 hover:bg-transparent [&_svg]:size-4.5',
        SEE_ALL,
        TEXT_SUB,
      )}
      onClick={onSeeAll}
    >
      <span className="inline-flex items-center gap-0.5 font-medium text-fg-secondary group-hover/all:text-fg">
        {`전체 ${total}개 보기`}
        <ChevronRight aria-hidden />
      </span>
    </Button>
  )
}

export default function C2E2(props: C2Props) {
  const { data, onCreate, onSeeAll } = props
  if (data.total === 0) return <Empty canCreate={data.canCreate} onCreate={onCreate} />
  const shown = data.events.slice(0, C2_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className={TRAY}>
      <div className={cn('flex items-baseline gap-2', TRAY_HEAD)}>
        <h2 id={HEAD_ID} className={cn('min-w-0 text-fg', TEXT_HEAD)}>
          {C2_TITLE}
        </h2>
        <span className={cn('shrink-0 text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
      </div>
      <ul className={GROUP}>
        {shown.map((event, index) => (
          <EventRow key={event.id} event={event} last={index === shown.length - 1} props={props} />
        ))}
      </ul>
      {data.total > C2_SHOWN && <SeeAll total={data.total} onSeeAll={onSeeAll} />}
    </section>
  )
}
