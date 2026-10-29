import { useRef } from 'react'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C2_EMPTY, C2_SHOWN, C2_TITLE } from '../c2-data'
import type { C2Props } from '../c2-props'
import { useAxis } from './axis'
import { AxisHead, TodayLine } from './AxisHead'
import { EventRow } from './EventRow'
import { EMPTY, EMPTY_DOT, GROUP, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// e6: e3(가로 시간 축)를 다듬은 안.
// 행사 색 = 행사 id로 정한 정체성 색(event-color.ts). 줄 앞 작은 네모·막대·날짜 머리 네모가 같은 색이다.
// 일정 글 'D-2 신청 마감'은 줄마다 이름과 같은 x에서 시작하고, 그 아래 막대가 오늘 → 그날까지를 그린다.
// 막대는 오늘 쪽이 진하고 축 끝으로 옅어져 먼 일정이 가장 큰 덩어리가 되지 않는다. 창 밖 일정은 축 끝에서 끊고 '11월 6일 (금) →'.

const HEAD_ID = 'c2-e6-head'

function Empty({ canCreate, onCreate }: Pick<C2Props, 'onCreate'> & { canCreate: boolean }) {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', EMPTY)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          EMPTY_DOT,
        )}
      >
        <CalendarDays className="size-4.5" strokeWidth={2} />
      </span>
      <h2 id={HEAD_ID} className={cn('min-w-0 flex-1 font-medium text-fg-secondary', TEXT_SUB)}>
        {C2_EMPTY}
      </h2>
      {canCreate && (
        <Button
          variant="link"
          className={cn(
            'h-auto min-h-11 shrink-0 gap-1 rounded-full border-0 px-3 py-0 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4.5',
            TEXT_SUB,
          )}
          onClick={onCreate}
        >
          <Plus aria-hidden />새 행사
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
        'group/all mt-0.5 w-full gap-0.5 rounded-2xl border-0 px-3 py-2 font-medium text-fg-secondary hover:bg-transparent hover:text-fg [&_svg]:size-4.5',
        SEE_ALL,
        TEXT_SUB,
      )}
      onClick={onSeeAll}
    >
      {`전체 ${total}개 보기`}
      <ChevronRight aria-hidden />
    </Button>
  )
}

export default function C2E6(props: C2Props) {
  const { data, onCreate, onSeeAll } = props
  const frame = useRef<HTMLDivElement>(null)
  const axis = useAxis(frame)
  if (data.total === 0) return <Empty canCreate={data.canCreate} onCreate={onCreate} />
  const shown = data.events.slice(0, C2_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className={TRAY}>
      <div className={cn('flex items-baseline gap-2', TRAY_HEAD)}>
        <h2 id={HEAD_ID} className={cn('text-fg', TEXT_HEAD)}>
          {C2_TITLE}
        </h2>
        <span className={cn('text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
      </div>
      <div className={cn('isolate', GROUP)}>
        <div ref={frame} className="relative">
          <TodayLine axis={axis} />
          <AxisHead axis={axis} events={shown} />
          <ul>
            {shown.map(event => (
              <EventRow key={event.id} event={event} axis={axis} actions={props} />
            ))}
          </ul>
        </div>
      </div>
      {data.total > C2_SHOWN && <SeeAll total={data.total} onSeeAll={onSeeAll} />}
    </section>
  )
}
