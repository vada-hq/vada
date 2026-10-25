import { useEffect, useRef } from 'react'
import type { CouncilView, EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { EventMoneyAdd } from './EventMoneyAdd'
import { SettlementRemaining } from './SettlementRemaining'
import { SettlementItems, SettlementNumbers } from './SettlementSummary'
import type { EventDialogHandlers } from './useEventSubmit'
import { useSettlement } from './useSettlement'

type Props = EventDialogHandlers & {
  view: CouncilView
  event: EventDetail
  // 바뀌면 정산을 다시 읽는다. 머리의 완료·완료 취소가 참가비 수입과 남은 것을 바꾼다(DEC-93: [완료]는 머리에 있다).
  refresh: number
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

// 재정 탭: 예산·실제·차이, 예산 항목마다 쓴 돈, 정산에 남은 것. 보이는 동안 정산을 15초마다 다시 읽는다.
// 정산 숫자와 남은 것은 모든 운영진이 본다. [완료]는 행사 머리에 있다(DEC-93).
export function EventMoneyTab({
  view,
  event,
  refresh: refreshKey,
  reloadEvent,
  ...handlers
}: Props) {
  const councilId = view.council.id
  const settlement = useSettlement(councilId, event.id, handlers)
  useReloadOn(refreshKey, settlement.reload)
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
    </div>
  )
}

// 번호가 바뀔 때만 다시 읽는다(처음 읽기는 useSettlement가 한다).
function useReloadOn(key: number, reload: () => Promise<void>) {
  const seen = useRef(key)
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    void reload()
  }, [key, reload])
}
