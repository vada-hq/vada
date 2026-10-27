import { ChartNoAxesColumn, ChevronRight } from 'lucide-react'
import type { HomeFinanceBoard, FinanceOverviewEvent } from '@vada/contracts'
import { TwoPartMeter } from '@/components/TwoPartMeter'
import { Button } from '@/components/ui/button'
import { wonLabel } from '../finance/purchase-view'
import HomeCard from './HomeCard'

function BudgetNumbers({ row }: { row: FinanceOverviewEvent }) {
  return (
    <div className="flex flex-col gap-1.5">
      {row.amount > 0 && (
        <TwoPartMeter
          first={row.actual}
          second={row.committed}
          max={row.amount}
          labels={{
            first: `${row.event.name} 실제 지출`,
            both: `${row.event.name} 지출 예정 포함`,
          }}
        />
      )}
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-right text-xs tabular-nums">
        <span className="ml-auto text-gray-500">
          실제 지출 <strong className="text-gray-900">{wonLabel(row.actual)}</strong>
        </span>
        <span className="ml-auto text-gray-500">
          지출 예정 <strong className="text-gray-900">{wonLabel(row.committed)}</strong>
        </span>
        <span className="ml-auto text-gray-500">
          사용 가능{' '}
          <strong className={row.available < 0 ? 'text-red-600' : 'text-blue-600'}>
            {wonLabel(row.available)}
          </strong>
        </span>
      </div>
    </div>
  )
}

export default function FinanceBudgets({
  budgets,
  onOpen,
  onSeeAll,
}: {
  budgets: HomeFinanceBoard['budgets']
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  const rows = budgets.events.map(({ event, budget }) => (
    <li key={event.id} className="relative flex min-w-0 flex-col gap-2 px-5 py-3 hover:bg-gray-50">
      <div className="flex items-start gap-2">
        <Button
          variant="link"
          className="h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm break-keep whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0"
          onClick={() => onOpen(event.id)}
        >
          <span className="line-clamp-2">{event.name}</span>
        </Button>
        <span className="shrink-0 text-right text-xs text-gray-500 tabular-nums">
          {budget === null ? '예산 미입력' : `배정 ${wonLabel(budget.amount)}`}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-400" />
      </div>
      {budget !== null && <BudgetNumbers row={budget} />}
    </li>
  ))
  return (
    <HomeCard
      title="행사별 예산"
      icon={ChartNoAxesColumn}
      unit="개"
      read={{ kind: 'ready', total: budgets.total, rows }}
      empty="행사 예산 없음"
      onSeeAll={onSeeAll}
    />
  )
}
