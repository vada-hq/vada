import { CalendarCheck, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C2_EMPTY, C2_SHOWN, C2_TITLE } from '../c2-data'
import type { C2Props } from '../c2-props'
import { EventRow } from './EventRow'
import { EMPTY, EMPTY_DOT, GROUP, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// e4: 남은 날 알약 + 신청 게이지(c2-refs '마'). ①(f8)과 같은 회색 쟁반 위 흰 묶음에 행사 줄을 쌓는다.
// 줄 앞 짙은 알약이 세로 열로 서 '며칠 남았나'가 먼저 읽히고, 신호는 오른쪽 칸(358은 아래)에 글로 흐른다.
// 신청 게이지는 신청 기간 + 정원 있는 행사에만 생긴다(그 밖에는 막대도 빈 자리도 없다).

const HEAD_ID = 'c2-e4-head'

// 0개: 회색 띠 한 줄. 달력 원 + '진행 중인 행사 없음' + (만들 권한이 있으면) 새 행사.
function Empty({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', EMPTY)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          EMPTY_DOT,
        )}
      >
        <CalendarCheck className="size-4.5" strokeWidth={2.25} />
      </span>
      <h2 id={HEAD_ID} className={cn('min-w-0 flex-1 font-medium text-fg-secondary', TEXT_SUB)}>
        {C2_EMPTY}
      </h2>
      {canCreate && (
        <Button
          variant="link"
          className={cn(
            'h-11 shrink-0 gap-1 rounded-full border-0 px-3 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4.5',
            TEXT_SUB,
          )}
          onClick={onCreate}
        >
          <Plus aria-hidden strokeWidth={2.5} />새 행사
        </Button>
      )}
    </section>
  )
}

export default function C2E4(props: C2Props) {
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
        {shown.map(event => (
          <EventRow key={event.id} event={event} props={props} />
        ))}
      </ul>
      {data.total > C2_SHOWN && (
        <Button
          variant="ghost"
          className={cn(
            'h-auto w-full gap-0.5 rounded-2xl border-0 px-3 py-2 font-medium text-fg-secondary hover:bg-transparent hover:text-fg [&_svg]:size-4.5',
            SEE_ALL,
            TEXT_SUB,
          )}
          onClick={onSeeAll}
        >
          {`전체 ${data.total}개 보기`}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </section>
  )
}
