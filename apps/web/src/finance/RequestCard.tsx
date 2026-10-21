import type { PurchaseRequestSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { neededByLabel } from './purchase-view'
import { StatusBadge } from './StatusBadge'

// 요청 카드: 제목(눌러 상세), 상태, 요청한 사람, 필요한 때, 품목 수. 목록의 제목은 화면 제목(h1) 바로 아래라 h2다.
export default function RequestCard({
  request,
  onOpen,
}: {
  request: PurchaseRequestSummary
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
        <span>{neededByLabel(request.neededBy)}</span>
        <span>품목 {request.itemCount}개</span>
      </div>
    </Card>
  )
}
