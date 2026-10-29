import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BOARD_COLUMNS,
  COLUMN_TEXT,
  cardsIn,
  countsOf,
  stacksOf,
  type BoardCard,
  type BoardColumn,
} from './purchase-board'
import { PurchaseItemCard } from './PurchaseItemCard'

type Props = {
  cards: BoardCard[]
  showEvent: boolean
  onOpen: (requestId: string) => void
}

// 품목 현황 칸반(와이어프레임 PUR-00 03·EVT-FIN-01 03): 단계 칩 줄과 진행 단계 열. 칩을 누르면 그 열로 옮겨 간다.
// 열이 여덟이라 넓은 화면에서도 옆으로 넘기며 본다(와이어프레임과 같다).
export function PurchaseItemBoard({ cards, showEvent, onOpen }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const counts = countsOf(cards)
  const goTo = (column: BoardColumn) =>
    scroller.current
      ?.querySelector(`[data-column="${column}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  return (
    <div className="flex flex-col gap-4">
      <StageChips counts={counts} onPick={goTo} />
      <div ref={scroller} className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map(column => (
          <BoardLane
            key={column}
            column={column}
            cards={cardsIn(cards, column)}
            showEvent={showEvent}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

function StageChips({
  counts,
  onPick,
}: {
  counts: Record<BoardColumn, number>
  onPick: (column: BoardColumn) => void
}) {
  return (
    <ol aria-label="진행 단계" className="flex flex-wrap items-center gap-1">
      {BOARD_COLUMNS.map((column, index) => (
        <li key={column} className="flex items-center gap-1">
          {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-fg-faint" />}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'rounded-full',
              column === 'attention' &&
                counts.attention > 0 &&
                'border-danger-border bg-danger-surface text-danger',
            )}
            onClick={() => onPick(column)}
          >
            {COLUMN_TEXT[column].label}
            <span className="font-bold tabular-nums">{counts[column]}</span>
          </Button>
        </li>
      ))}
    </ol>
  )
}

function BoardLane({
  column,
  cards,
  showEvent,
  onOpen,
}: {
  column: BoardColumn
  cards: BoardCard[]
  showEvent: boolean
  onOpen: (requestId: string) => void
}) {
  const text = COLUMN_TEXT[column]
  const alert = column === 'attention'
  return (
    <section
      data-column={column}
      aria-label={text.label}
      className="flex w-68 shrink-0 scroll-ml-1 flex-col gap-2"
    >
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="flex flex-col">
          <h2 className={cn('text-sm font-semibold', alert ? 'text-danger' : 'text-fg')}>
            {text.label}
          </h2>
          <p className="text-xs text-fg-muted">{text.hint}</p>
        </div>
        <span
          className={cn(
            'rounded-full px-1.5 text-xs font-semibold tabular-nums',
            alert && cards.length > 0
              ? 'bg-danger-surface text-danger'
              : 'bg-surface-muted text-fg-muted',
          )}
        >
          {cards.length}
        </span>
      </header>
      <div
        className={cn(
          'flex min-h-96 flex-1 flex-col gap-4 rounded-lg border border-dashed p-2',
          alert
            ? 'border-danger-border bg-danger-surface/40'
            : 'border-border-default bg-surface-subtle',
        )}
      >
        {cards.length === 0 ? (
          <p className="py-10 text-center text-xs text-fg-muted">품목 없음</p>
        ) : (
          stacksOf(cards).map(stack => (
            <PurchaseItemCard
              key={stack[0]?.item.id}
              stack={stack}
              showEvent={showEvent}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  )
}
