import { purchaseStageOf, type PurchaseRequestSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { neededByLabel, wonLabel, type NeededMark } from './purchase-view'
import { StatusBadge } from './StatusBadge'
import { dayLabel } from '@/lib/korean-date-text'
import { RequestProgress } from './RequestProgress'

function NeededBy({ date, mark }: { date: string | null; mark: NeededMark }) {
  if (!date) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      {neededByLabel(date)}
      {mark === 'soon' && <Badge tone="warning">임박</Badge>}
      {mark === 'overdue' && <Badge tone="danger">지남</Badge>}
    </span>
  )
}

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
    <Card className="flex flex-col gap-2 p-4 break-keep">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            touch
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg wrap-anywhere break-keep"
            onClick={onOpen}
          >
            <span className="line-clamp-2 sm:line-clamp-1">{request.title}</span>
          </Button>
        </h2>
        <StatusBadge status={request.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="wrap-anywhere">{request.requestedBy.name}</span>
        <NeededBy date={request.neededBy} mark={mark} />
        <span>품목 {request.itemCount}개</span>
        <span>요청일 {dayLabel(request.createdAt)}</span>
        {request.event && <span className="wrap-anywhere">{request.event.name}</span>}
        {request.estimate?.total != null ? (
          <span>예상 {wonLabel(request.estimate.total)}</span>
        ) : (
          request.estimate?.subtotal != null && (
            <span>상품 {wonLabel(request.estimate.subtotal)} · 배송비 미확인</span>
          )
        )}
      </div>
      {request.bodyPreview && (
        <p className="text-xs wrap-anywhere text-fg-tertiary">{request.bodyPreview}</p>
      )}
      <CardProgress request={request} />
    </Card>
  )
}

function CardProgress({ request }: { request: PurchaseRequestSummary }) {
  if (!request.progress || purchaseStageOf(request) === 'closed') return null
  return <RequestProgress request={request} />
}
