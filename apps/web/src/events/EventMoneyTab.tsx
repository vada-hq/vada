import { useEffect, useRef } from 'react'
import { EVENT_PURCHASE_VIEWS, type CouncilView, type EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { usePurchases } from '@/finance/usePurchases'
import { RequestFilter } from '@/purchases/RequestFilter'
import { PurchaseStages } from '@/purchases/PurchaseStages'
import { PurchasesBody } from '@/purchases/PurchasesBody'
import { EventMoneyAdd } from './EventMoneyAdd'
import { SettlementRemaining } from './SettlementRemaining'
import { SettlementBudget } from './SettlementSummary'
import { useEventPurchaseAddress } from './useEventAddress'
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

function SettlementBody({ settlement }: { settlement: ReturnType<typeof useSettlement> }) {
  const { state } = settlement
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{SETTLEMENT_LOAD_FAILED}</StateMessage>
        <Button touch variant="outline" onClick={() => void settlement.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return <SettlementBudget settlement={state.data.settlement} />
}

// 구매 탭: 예산 요약 → 이 행사의 구매 요청 → 정산에 남은 것. 정산과 목록은 보이는 동안 15초마다 다시 읽는다.
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
  const address = useEventPurchaseAddress(councilId, event.id)
  const list = usePurchases(councilId, address.view, handlers.onForbidden, {
    event: event.id,
    stage: address.stage,
  })
  useReloadOn(refreshKey, settlement.reload)
  useReloadOn(refreshKey, list.reload)
  const refresh = () => {
    void settlement.reload()
    void list.reload()
    void reloadEvent()
  }
  return (
    <div className="flex flex-col gap-6">
      <SettlementBody settlement={settlement} />
      <EventMoneyAdd
        view={view}
        event={event}
        onAdded={refresh}
        budgetNames={
          settlement.state.kind === 'ready'
            ? settlement.state.data.settlement.budget.items.map(item => item.purpose)
            : []
        }
        {...handlers}
      />
      <section aria-label="행사 구매 요청" className="flex flex-col gap-4">
        <RequestFilter
          views={EVENT_PURCHASE_VIEWS}
          view={address.view}
          onView={next => address.set({ view: next, stage: null })}
        />
        <PurchaseStages
          counts={list.state.kind === 'ready' ? list.state.stageCounts : undefined}
          stage={address.stage}
          onStage={stage => address.set({ stage })}
        />
        <PurchasesBody
          list={list}
          view={address.view}
          onOpen={id => openRecord('purchases', councilId, id)}
        />
      </section>
      {settlement.state.kind === 'ready' && (
        <SettlementRemaining
          settlement={settlement.state.data.settlement}
          onOpenRequest={id => openRecord('purchases', councilId, id)}
          onOpenExpense={id => openRecord('expenses', councilId, id)}
        />
      )}
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
