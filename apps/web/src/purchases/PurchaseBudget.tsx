import { statusOf, type SettlementResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { eventPath } from '@/events/event-api'
import { openMenu } from '@/lib/go-to'
import { usePolledRead } from '@/lib/use-polled-read'
import { cn } from '@/lib/utils'
import { PurchaseBudgetSummary } from './PurchaseBudgetSummary'

export function PurchaseBudget({
  councilId,
  scope,
  onForbidden,
}: {
  councilId: string
  scope: string | undefined
  onForbidden: () => void
}) {
  // 전체·상시는 예산을 합산하지 않는다. 학생회 전체 예산은 재정의 예산 현황에 있다(와이어프레임 PUR-00 02).
  if (!scope || scope === 'none')
    return (
      <p className={cn(cardClass, 'px-4 py-3 text-sm text-fg-muted shadow-none')}>
        학생회 전체 예산은{' '}
        <Button
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => openMenu('finance', councilId)}
        >
          재정 › 예산 현황
        </Button>
        에서 봐요.
      </p>
    )
  return <EventBudget key={scope} councilId={councilId} eventId={scope} onForbidden={onForbidden} />
}

function EventBudget({
  councilId,
  eventId,
  onForbidden,
}: {
  councilId: string
  eventId: string
  onForbidden: () => void
}) {
  const read = usePolledRead<SettlementResponse>(
    `${eventPath(councilId, eventId)}/settlement`,
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
  )
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">행사 예산 불러오는 중…</StateMessage>
  if (read.state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-2">
        <StateMessage kind="error">행사 예산을 불러오지 못했어요.</StateMessage>
        <Button touch variant="outline" onClick={() => void read.reload()}>
          예산 다시 시도
        </Button>
      </div>
    )
  const { settlement } = read.state.data
  return <PurchaseBudgetSummary settlement={settlement} />
}
