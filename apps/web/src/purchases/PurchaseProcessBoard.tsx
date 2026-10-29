import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import { PURCHASE_AREAS, type PurchaseArea } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { stacksOf, type BoardCard } from './purchase-board'
import { AREAS, areaCount, laneCards } from './purchase-process'
import { ProcessItemCard } from './PurchaseItemCard'

type Props = {
  cards: BoardCard[]
  area: PurchaseArea
  onArea: (area: PurchaseArea) => void
  onOpen: (requestId: string) => void
}

// 재정부 처리 단계(와이어프레임 EVT-FIN-01B): 업무 영역을 고르면 그 영역의 단계 칸만 보인다. 예외 칸은 흐름 오른쪽에 따로 둔다.
export function PurchaseProcessBoard({ cards, area, onArea, onOpen }: Props) {
  const chosen = AREAS[area]
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="업무 영역" className="flex flex-wrap gap-2">
        {PURCHASE_AREAS.map(value => (
          <Button
            key={value}
            variant={value === area ? 'default' : 'outline'}
            aria-pressed={value === area}
            onClick={() => onArea(value)}
          >
            {AREAS[value].label}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                value === area ? 'bg-white/20' : 'bg-surface-muted text-fg-muted',
              )}
            >
              {areaCount(cards, value)}
            </span>
          </Button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {chosen.flow.map((lane, index) => (
          <Fragment key={lane.label}>
            {index > 0 && (
              <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 self-start text-fg-faint" />
            )}
            <Lane label={lane.label} cards={laneCards(cards, lane)} onOpen={onOpen} />
          </Fragment>
        ))}
        <div aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-warning-border" />
        {chosen.exceptions.map(lane => (
          <Lane key={lane.label} label={lane.label} exception cards={[]} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function Lane({
  label,
  cards,
  exception = false,
  onOpen,
}: {
  label: string
  cards: BoardCard[]
  exception?: boolean
  onOpen: (requestId: string) => void
}) {
  return (
    <section aria-label={label} className="flex w-64 shrink-0 flex-col gap-2">
      <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold text-fg">
        {exception && (
          <span className="rounded-sm border border-warning-border bg-warning-surface px-1 text-xs font-medium text-warning">
            예외
          </span>
        )}
        <span className={exception ? 'text-warning' : undefined}>{label}</span>
        <span className="font-normal text-fg-muted tabular-nums">{cards.length}</span>
      </h2>
      <div
        className={cn(
          'flex min-h-80 flex-col gap-4 rounded-lg border border-dashed p-2',
          exception
            ? 'border-warning-border bg-warning-surface/40'
            : 'border-border-default bg-surface-subtle',
        )}
      >
        {cards.length === 0 ? (
          <p className="py-8 text-center text-xs text-fg-muted">없음</p>
        ) : (
          stacksOf(cards).map(stack => (
            <ProcessItemCard key={stack[0]?.item.id} stack={stack} onOpen={onOpen} />
          ))
        )}
      </div>
    </section>
  )
}
