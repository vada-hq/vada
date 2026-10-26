import type { PurchaseRequestSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { neededByLabel, type NeededMark } from './purchase-view'
import { StatusBadge } from './StatusBadge'

// 요청 카드: 제목(눌러 상세), 상태, 요청한 사람, 필요한 때, 품목 수. 목록의 제목은 화면 제목(h1) 바로 아래라 h2다.
// mark가 있으면 필요한 때 옆에 '임박'(3일 안)이나 '지남'을 붙인다(결재 목록에서만, DEC-92).
export default function RequestCard({
  request,
  mark = null,
  onOpen,
}: {
  request: PurchaseRequestSummary
  mark?: NeededMark
  onOpen: () => void
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere"
            onClick={onOpen}
          >
            {request.title}
          </Button>
        </h2>
        <StatusBadge status={request.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="wrap-anywhere">{request.requestedBy.name}</span>
        <span className="inline-flex items-center gap-1.5">
          {neededByLabel(request.neededBy)}
          {mark === 'soon' && <Badge tone="warning">임박</Badge>}
          {mark === 'overdue' && <Badge tone="danger">지남</Badge>}
        </span>
        <span>품목 {request.itemCount}개</span>
      </div>
    </Card>
  )
}
