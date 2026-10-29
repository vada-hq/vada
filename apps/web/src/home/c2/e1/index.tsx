import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C2_EMPTY, C2_SHOWN, C2_TITLE } from '../c2-data'
import type { C2Props } from '../c2-props'
import { EventRow } from './EventRow'
import { GROUP, QUIET, QUIET_DOT, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// e1(c2 생김새 회차, 형태 '가. 줄 끝 큰 남은 날'): ①(f8)과 같은 회색 쟁반 위 흰 묶음에 행사 줄을 쌓는다.
// 줄 = 이름(굵게) + 그 아래 신호 글('·'로 이음) | 오른쪽 끝 고정 폭 남은 날 칸(큰 'D-1' + 작은 '행사 종료').
// 남은 날 칸이 줄마다 같은 자리에 서서 세로 한 열로 '며칠 남았나'를 읽힌다. 신호가 없으면 신호 줄이 없다.

const HEAD_ID = 'c2-e1-head'

// 0개: 회색 띠 한 줄. 달력 원 + '진행 중인 행사 없음' + [새 행사](만들 권한이 있을 때).
function Empty({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', QUIET)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          QUIET_DOT,
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
            'h-auto min-h-11 gap-1 rounded-full border-0 px-3 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4.5',
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
        'group/all h-auto w-full gap-0.5 rounded-2xl border-0 px-3 py-2 font-medium text-fg-secondary hover:bg-transparent hover:text-fg [&_svg]:size-4.5',
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

export default function C2E1(props: C2Props) {
  const { data } = props
  if (data.total === 0) return <Empty canCreate={data.canCreate} onCreate={props.onCreate} />
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
        {shown.map(event => (
          <EventRow key={event.id} event={event} {...props} />
        ))}
      </ul>
      {data.total > C2_SHOWN && <SeeAll total={data.total} onSeeAll={props.onSeeAll} />}
    </section>
  )
}
