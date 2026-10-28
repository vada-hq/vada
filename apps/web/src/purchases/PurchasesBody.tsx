import {
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  purchaseStageOf,
  type PurchaseStage,
  type PurchaseView,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { neededMarkOf } from '@/finance/purchase-view'
import RequestCard from '@/finance/RequestCard'
import type { PurchaseList } from '@/finance/usePurchases'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { useNow } from '@/lib/use-now'

export function PurchasesBody({
  list,
  view,
  stage,
  onOpen,
}: {
  list: PurchaseList
  view: PurchaseView
  stage: PurchaseStage | undefined
  onOpen: (requestId: string) => void
}) {
  const { state } = list
  // 목록에는 서버 시각이 없으므로 필요한 때 표시는 기기 시각을 쓴다.
  const now = useNow()
  if (state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button touch variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const shown = state.requests.filter(request => !stage || purchaseStageOf(request) === stage)
  return (
    <>
      {shown.length === 0 ? (
        <StateMessage kind="empty">구매 요청 없음</StateMessage>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map(request => (
            <li key={request.id}>
              <RequestCard
                request={request}
                mark={view === 'pending' ? neededMarkOf(request.neededBy, now) : null}
                onOpen={() => onOpen(request.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {state.truncated && (
        <StateMessage kind="notice">
          요청이 많아서 {view === 'pending' ? PURCHASE_PENDING_LIMIT : PURCHASE_RECENT_LIMIT}개만
          보여요.
        </StateMessage>
      )}
    </>
  )
}
