import type { ErrorCode } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'

// 읽기의 버튼 허용과 쓰기의 거절이 같은 기준을 쓴다. 쓰기는 행사 행을 잠근 뒤 이 사실을 읽는다.
export function shipmentChangeCode(
  actor: Actor,
  facts: {
    requestedBy: string
    requestCancelled: boolean
    eventCompleted: boolean
  },
): ErrorCode | null {
  if (!can(actor, 'purchase.shipment', { requestedBy: facts.requestedBy })) return 'FORBIDDEN'
  if (facts.eventCompleted) return 'EVENT_COMPLETED'
  return facts.requestCancelled ? 'REQUEST_CLOSED' : null
}
