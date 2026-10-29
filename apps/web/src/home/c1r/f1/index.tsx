import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { FocusCard } from './FocusCard'
import { QuietRow } from './QuietRow'
import { SHELL_PAD, SHELL_RADIUS, SHELL_SHADOW } from './tokens'

// f1: 큰 카드 하나에 초점(형태 가, 레퍼런스 f01 카카오뱅크 홈·f02 Live Activity·f03 쿠팡이츠 주문 상태).
// 바깥은 테두리 없는 흰 둥근 면 하나. 그 안에서 가장 급한 1건만 색 면 카드로 크게 올리고, 나머지(상한 5까지)는
// 머리글자 원이 붙은 테두리 없는 줄로 조용히 둔다. 넓은 폭(@2xl, 716·977)은 카드 왼쪽 + 줄 오른쪽, 358은 위아래.
// 0건이면 카드 없이 체크 원 + 이름 + '없음' 한 줄.

const HEAD_ID = 'c1r-f1-head'

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
      className={cn('h-auto gap-0.5 p-0 text-sm font-medium text-primary-strong', className)}
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
      <h2 id={HEAD_ID} className="min-w-0 text-lg font-bold text-fg break-keep wrap-anywhere">
        {C1R_TITLE}
      </h2>
      {total === 0 ? (
        <span className="ml-auto text-sm text-fg-muted">없음</span>
      ) : (
        <span
          aria-label={`${total}건`}
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-fg-secondary"
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

export default function C1rF1({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const [focus, ...rest] = data.rows.slice(0, C1R_SHOWN)
  const more = data.total > C1R_SHOWN
  const actions = { onOpen, onAsk, onOpenAsked, onAssign }
  return (
    <section
      aria-labelledby={HEAD_ID}
      className={cn(
        'bg-card text-card-foreground',
        SHELL_RADIUS,
        SHELL_SHADOW,
        data.total === 0 ? 'px-5 py-3' : SHELL_PAD,
      )}
    >
      <Head total={data.total} onSeeAll={onSeeAll} />
      {focus && (
        <div
          className={cn(
            'mt-4 grid grid-cols-[minmax(0,1fr)] gap-3',
            rest.length > 0 && '@2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:gap-5',
          )}
        >
          <FocusCard row={focus} solo={rest.length === 0} {...actions} />
          {rest.length > 0 && (
            <ul className="flex flex-col gap-1 @2xl:justify-center">
              {rest.map(row => (
                <QuietRow key={row.id} row={row} {...actions} />
              ))}
            </ul>
          )}
        </div>
      )}
      {more && (
        <div className="mt-1 flex justify-center @2xl:hidden">
          <SeeAll total={data.total} onSeeAll={onSeeAll} className="min-h-11 w-full" />
        </div>
      )}
    </section>
  )
}
