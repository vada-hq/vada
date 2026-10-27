import type { FinanceCommitmentsResponse } from '@vada/contracts'
import { statusOf } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { openRecord } from '@/lib/go-to'
import { usePolledRead } from '@/lib/use-polled-read'
import { councilPath } from './finance-api'
import { wonLabel } from './purchase-view'

export function CommitmentsView({
  items,
  onOpen,
}: FinanceCommitmentsResponse & { onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between gap-3 text-sm text-gray-500 tabular-nums" role="status">
        <span>{items.length}건</span>
        <span>합계 {wonLabel(items.reduce((sum, row) => sum + row.amount, 0))}</span>
      </div>
      {items.length === 0 && <StateMessage kind="empty">지출 예정 없음</StateMessage>}
      <ul className="flex flex-col gap-2">
        {items.map(row => (
          <li key={row.id}>
            <Card className="flex flex-col gap-2 p-4 text-sm break-keep">
              <div className="flex items-start justify-between gap-3">
                <Button
                  variant="link"
                  touch
                  className="min-w-0 justify-start p-0 text-left whitespace-normal wrap-anywhere"
                  onClick={() => onOpen(row.requestId)}
                >
                  {row.name}
                </Button>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {wonLabel(row.amount)}
                </span>
              </div>
              <span className="wrap-anywhere">{row.requestTitle}</span>
              <span className="text-xs text-gray-500 wrap-anywhere">
                {[row.event?.name, row.budgetItem.purpose].filter(Boolean).join(' · ')}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CommitmentsPanel({
  councilId,
  periodId,
  onForbidden,
}: {
  councilId: string
  periodId: string | null
  onForbidden: () => void
}) {
  const path = `${councilPath(councilId)}/finance-commitments${periodId ? `?period=${encodeURIComponent(periodId)}` : ''}`
  const read = usePolledRead<FinanceCommitmentsResponse>(path, status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">지출 예정 불러오는 중…</StateMessage>
  if (read.state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">지출 예정을 불러오지 못했어요.</StateMessage>
        <Button variant="outline" touch onClick={() => void read.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return (
    <CommitmentsView
      items={read.state.data.items}
      onOpen={id => openRecord('purchases', councilId, id)}
    />
  )
}
