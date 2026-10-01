import type { DeliveryStatus } from '@vada/contracts'

// 검증되지 않은 코드를 출발 전이나 완료로 추정하지 않는다.
export function deliveryStatus(code: string): DeliveryStatus {
  switch (code) {
    case 'INFORMATION_RECEIVED': return 'pending'
    case 'AT_PICKUP': case 'IN_TRANSIT': case 'OUT_FOR_DELIVERY': case 'AVAILABLE_FOR_PICKUP': return 'in_transit'
    case 'ATTEMPT_FAIL': case 'EXCEPTION': return 'exception'
    case 'DELIVERED': return 'delivered'
    default: return 'unknown'
  }
}
