import type { LineItemStatus, PurchaseStatus } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { ITEM_STATUS_LABEL, ITEM_STATUS_TONE, STATUS_LABEL, STATUS_TONE } from './purchase-view'

// 요청 전체의 상태 배지(결재 대기, 승인, 일부 승인, 반려, 취소)
export function StatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

// 품목 하나의 상태 배지(대기, 승인, 반려)
export function ItemStatusBadge({ status }: { status: LineItemStatus }) {
  return <Badge tone={ITEM_STATUS_TONE[status]}>{ITEM_STATUS_LABEL[status]}</Badge>
}
