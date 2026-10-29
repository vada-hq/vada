import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Row } from './Row'
import { GROUP, QUIET, QUIET_DOT, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// f7 생김새 회차(c1f) '아. 회색 바탕 위 아이콘 줄'(f19 토스 홈, f20 토스 혜택).
// 구역을 연회색 쟁반으로 깔고, 그 위에 테두리·그림자 없는 흰 둥근 묶음 하나. 줄은 이유 아이콘 원 + 큰 제목 + 파란 행동 줄,
// 사실은 오른쪽 끝. '전체 n건 보기'는 묶음 아래 가운데. 0건이면 쟁반 한 줄만 남는다.

const HEAD_ID = 'c1r-f7-head'

// 0건: 회색 띠 한 줄. 체크 원 + '○○ 없음'.
function Quiet() {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', QUIET)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          QUIET_DOT,
        )}
      >
        <Check className="size-4.5" strokeWidth={2.5} />
      </span>
      <h2 id={HEAD_ID} className={cn('min-w-0 font-medium text-fg-secondary', TEXT_SUB)}>
        {`${C1R_TITLE} 없음`}
      </h2>
    </section>
  )
}

export default function C1rF7({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  if (data.total === 0) return <Quiet />
  const rows = data.rows.slice(0, C1R_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className={TRAY}>
      <div className={cn('flex items-baseline gap-2', TRAY_HEAD)}>
        <h2 id={HEAD_ID} className={cn('min-w-0 text-fg break-keep', TEXT_HEAD)}>
          {C1R_TITLE}
        </h2>
        <span className={cn('shrink-0 text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
      </div>
      <ul className={GROUP}>
        {rows.map(row => (
          <Row
            key={row.id}
            row={row}
            onOpen={onOpen}
            onAsk={onAsk}
            onOpenAsked={onOpenAsked}
            onAssign={onAssign}
          />
        ))}
      </ul>
      {data.total > C1R_SHOWN && (
        <Button
          variant="ghost"
          className={cn(
            'w-full gap-0.5 rounded-2xl font-medium text-fg-secondary hover:bg-transparent hover:text-fg [&_svg]:size-4.5',
            SEE_ALL,
            TEXT_SUB,
          )}
          onClick={onSeeAll}
        >
          {`전체 ${data.total}건 보기`}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </section>
  )
}
