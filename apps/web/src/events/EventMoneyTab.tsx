import type { CouncilView, EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { EventCompletion } from './EventCompletion'
import { EventMoneyAdd } from './EventMoneyAdd'
import { SettlementRemaining } from './SettlementRemaining'
import { SettlementItems, SettlementNumbers } from './SettlementSummary'
import type { EventDialogHandlers } from './useEventSubmit'
import { useSettlement } from './useSettlement'

type Props = EventDialogHandlers & {
  view: CouncilView
  event: EventDetail
  // 완료·완료 취소가 돌려준 행사. 부모가 화면의 값으로 놓고 목록을 다시 읽는다.
  onEventChanged: (event: EventDetail) => void
  // 행사를 다시 읽는다(상태와 동작이 바뀌었을 수 있다).
  reloadEvent: () => Promise<void>
}

function SettlementBody({
  settlement,
  onOpenRequest,
  onOpenExpense,
}: {
  settlement: ReturnType<typeof useSettlement>
  onOpenRequest: (requestId: string) => void
  onOpenExpense: (expenseId: string) => void
}) {
  const { state } = settlement
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{SETTLEMENT_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void settlement.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const data = state.data.settlement
  return (
    <>
      <SettlementNumbers settlement={data} />
      <SettlementItems items={data.budget.items} />
      <SettlementRemaining
        settlement={data}
        onOpenRequest={onOpenRequest}
        onOpenExpense={onOpenExpense}
      />
    </>
  )
}

// 예산·정산 탭: 예산·실제·차이, 예산 항목마다 쓴 돈, 정산에 남은 것, 완료. 보이는 동안 정산을 15초마다 다시 읽는다.
// 정산 숫자와 남은 것은 모든 운영진이 보고, 완료 버튼은 서버가 준 동작이 있는 사람만 본다.
export function EventMoneyTab({ view, event, onEventChanged, reloadEvent, ...handlers }: Props) {
  const councilId = view.council.id
  const settlement = useSettlement(councilId, event.id, handlers)
  const refresh = () => {
    void settlement.reload()
    void reloadEvent()
  }
  return (
    <div className="flex flex-col gap-6">
      <EventMoneyAdd view={view} event={event} onAdded={refresh} {...handlers} />
      <SettlementBody
        settlement={settlement}
        onOpenRequest={id => openRecord('purchases', councilId, id)}
        onOpenExpense={id => openRecord('expenses', councilId, id)}
      />
      <EventCompletion
        councilId={councilId}
        event={event}
        onDone={next => {
          onEventChanged(next)
          void settlement.reload()
        }}
        onStale={refresh}
        {...handlers}
      />
    </div>
  )
}
