import {
  PURCHASE_ACTIONS,
  type LineItemStatus,
  type PurchaseAction,
  type PurchaseStatus,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'

// 요청 상태는 저장하지 않고 센다(명세 '요청 상태'). 취소면 취소, 결재 안 된 품목이 있으면 대기,
// 모두 승인이면 승인, 모두 반려면 반려, 섞이면 일부 승인이다.
export function requestStatusOf(
  cancelled: boolean,
  counts: { items: number; approved: number; rejected: number },
): PurchaseStatus {
  if (cancelled) return 'cancelled'
  if (counts.approved + counts.rejected < counts.items) return 'pending'
  if (counts.rejected === 0) return 'approved'
  return counts.approved === 0 ? 'rejected' : 'partial'
}

export const lineItemStatusOf = (outcome: string | null): LineItemStatus =>
  outcome === 'approved' || outcome === 'rejected' ? outcome : 'pending'

type RequestFacts = { requestedBy: string; status: PurchaseStatus; decided: number }

// 그 사람이 이 요청에서 할 수 있는 동작. 취소는 요청한 사람만이고 결재가 시작되면 닫힌다.
// 쓰기 경로도 같은 규칙으로 묻는다(canCancel). 보이는 동작과 되는 동작이 갈리지 않는다.
export const canCancel = (actor: Actor, facts: RequestFacts) =>
  facts.status !== 'cancelled' &&
  facts.decided === 0 &&
  can(actor, 'purchase.cancel', { requestedBy: facts.requestedBy })

export function actionsOf(actor: Actor, facts: RequestFacts): PurchaseAction[] {
  return PURCHASE_ACTIONS.filter(action =>
    action === 'purchase.cancel'
      ? canCancel(actor, facts)
      : facts.status === 'pending' && can(actor, action),
  )
}
