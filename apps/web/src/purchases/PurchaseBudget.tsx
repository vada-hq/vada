import { statusOf, type SettlementResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { SettlementBudget } from '@/events/SettlementSummary'
import { eventPath } from '@/events/event-api'
import { openMenu } from '@/lib/go-to'
import { usePolledRead } from '@/lib/use-polled-read'

export function PurchaseBudget({
  councilId,
  scope,
  onForbidden,
}: {
  councilId: string
  scope: string | undefined
  onForbidden: () => void
}) {
  if (!scope || scope === 'none')
    return (
      <Button
        touch
        variant="link"
        className="self-start"
        onClick={() => openMenu('finance', councilId)}
      >
        예산 현황
      </Button>
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
  return <SettlementBudget settlement={settlement} />
}
