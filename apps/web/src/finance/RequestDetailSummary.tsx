import { recordPath, type PurchaseRequestDetail } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/app-location'
import { wonLabel } from './purchase-view'

export function RequestDetailSummary({
  request,
  councilId,
}: {
  request: PurchaseRequestDetail
  councilId: string
}) {
  const estimate = request.estimate
  return (
    <>
      <h2 className="text-base font-semibold">요청 요약</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-fg-muted">품목 수</dt>
        <dd>{request.itemCount}개</dd>
        <dt className="text-fg-muted">예상 금액</dt>
        <dd className="font-semibold tabular-nums">
          {estimate?.total != null ? wonLabel(estimate.total) : '미확인'}
        </dd>
      </dl>
      {estimate?.total == null && estimate?.subtotal != null && (
        <p className="text-xs text-fg-muted">
          상품 합계 {wonLabel(estimate.subtotal)} · 배송비 미확인
        </p>
      )}
      {request.event && (
        <Button
          variant="link"
          className="h-auto justify-start p-0 whitespace-normal wrap-anywhere"
          onClick={() => navigate(recordPath('events', councilId, request.event!.id))}
        >
          {request.event.name}
        </Button>
      )}
      {request.sourceMessage && (
        <Button
          variant="link"
          className="h-auto justify-start p-0"
          onClick={() => navigate(recordPath('chat', councilId, request.sourceMessage!.roomId))}
        >
          원문이 있는 대화방
        </Button>
      )}
    </>
  )
}
