import { useEffect, useRef } from 'react'
import type { CouncilView, EventDetail } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { usePurchases } from '@/finance/usePurchases'
import { MyPurchaseRequests } from '@/purchases/MyPurchaseRequests'
import { PurchaseBudgetSummary } from '@/purchases/PurchaseBudgetSummary'
import { PurchaseHeadActions } from '@/purchases/PurchaseHeadActions'
import { PurchaseWork } from '@/purchases/PurchaseWork'
import { usePurchaseBoardQuery, whoOf } from '@/purchases/purchase-board-query'
import { useEventMoneyAdd } from './EventMoneyAdd'
import { SettlementRemaining } from './SettlementRemaining'
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

// 구매 탭(와이어프레임 EVT-FIN-01·01B): 예산 요약 → 구매 작업(품목 현황, 재정부는 처리 단계·요청 기록) → 정산에 남은 것.
// 정산과 목록은 보이는 동안 15초마다 다시 읽는다. 정산 숫자와 남은 것은 모든 운영진이 본다. [완료]는 행사 머리에 있다(DEC-93).
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
  const board = usePurchaseBoardQuery(view, address.query)
  const list = usePurchases(councilId, board.fetchView, handlers.onForbidden, { event: event.id })
  useReloadOn(refreshKey, settlement.reload)
  useReloadOn(refreshKey, list.reload)
  const refresh = () => {
    void settlement.reload()
    void list.reload()
    void reloadEvent()
  }
  const add = useEventMoneyAdd({
    view,
    event,
    onAdded: refresh,
    budgetNames:
      settlement.state.kind === 'ready'
        ? settlement.state.data.settlement.budget.items.map(item => item.purpose)
        : [],
    ...handlers,
  })
  const open = (id: string) => openRecord('purchases', councilId, id)
  if (board.page === 'mine')
    return (
      <>
        <MyPurchaseRequests
          requests={list.state.kind === 'ready' ? list.state.requests : []}
          who={whoOf(view)}
          onBack={() => address.set({ page: null })}
          onCreate={add.createRequest}
          onOpen={open}
        />
        {add.dialogs}
      </>
    )
  return (
    <div className="flex flex-col gap-6">
      <PageActions>
        <PurchaseHeadActions
          onMine={() => address.set({ page: 'mine' })}
          onCreate={add.createRequest}
        />
      </PageActions>
      <SettlementBody settlement={settlement} actions={add.financeActions} />
      <PurchaseWork
        list={list}
        canProcess={board.canProcess}
        board={board.board}
        area={board.area}
        view={board.view}
        onBoard={next => address.set({ board: next })}
        onArea={next => address.set({ area: next })}
        onView={next => address.set({ view: next })}
        showEvent={false}
        onOpen={open}
      />
      {settlement.state.kind === 'ready' && (
        <SettlementRemaining
          settlement={settlement.state.data.settlement}
          onOpenRequest={open}
          onOpenExpense={id => openRecord('expenses', councilId, id)}
        />
      )}
      {add.dialogs}
    </div>
  )
}

function SettlementBody({
  settlement,
  actions,
}: {
  settlement: ReturnType<typeof useSettlement>
  actions: React.ReactNode
}) {
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
  return <PurchaseBudgetSummary settlement={state.data.settlement} actions={actions} />
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
