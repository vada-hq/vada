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

// e3: 가로 시간 축(c2-refs '다', e07 Linear 타임라인 + e08·e09 날짜 머리).
// 흰 묶음 위쪽에 오늘부터 14일(358은 7일) 날짜 머리, 오늘 자리에서 짙은 세로선이 내려온다.
// 행사 줄 = 머리글자 네모(오늘 선 왼쪽) | 이름 + 신호 알약, 그 아래 선로에 오늘 점 → 다음 일정 마름모 선분과 'D-2 신청 마감'.
// 선분 길이가 남은 날이라 '무엇이 가까운가'가 위치로 보이고, 선로의 하루 눈금이 평소(신호 없음)에도 축을 채운다.

const HEAD_ID = 'c2-e3-head'

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

export default function C2E3(props: C2Props) {
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
          <AxisHead axis={axis} />
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
