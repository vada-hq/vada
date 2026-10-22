import type { ClosingStatus } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, STATUS_TONE } from './closing-view'

// 결산 상태 배지(작성 중, 공개됨)
export function ClosingStatusBadge({ status }: { status: ClosingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}
