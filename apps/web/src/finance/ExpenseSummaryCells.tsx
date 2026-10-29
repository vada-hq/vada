import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { summarizeExpenses } from './expense-summary'
import { wonLabel } from './purchase-view'

export function ExpenseSummaryCells({
  summary,
}: {
  summary: ReturnType<typeof summarizeExpenses>
}) {
  const cells = [
    { label: '지출 합계', value: wonLabel(summary.amount), tone: 'text-fg' },
    {
      label: '건수',
      value: `${summary.count}건`,
      tone: summary.count ? 'text-fg' : 'text-fg-muted',
    },
    {
      label: '증빙 없음',
      value: `${summary.missingEvidence}건`,
      tone: summary.missingEvidence ? 'text-attention' : 'text-fg-muted',
    },
  ]
  return (
    <dl role="status" className="grid grid-cols-3 gap-2">
      {cells.map(cell => (
        <div key={cell.label} className={cn(cardClass, 'min-w-0 p-3')}>
          <dt className="text-xs break-keep text-fg-muted">{cell.label}</dt>
          <dd
            className={cn(
              'mt-1 text-base font-semibold break-keep tabular-nums wrap-anywhere',
              cell.tone,
            )}
          >
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
