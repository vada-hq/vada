import { PURCHASE_VIEWS, type PurchaseView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { VIEW_LABEL } from '@/finance/purchase-view'

// 구매 목록의 거르기(내 요청, 결재 대기, 전체)
export function RequestFilter({
  view,
  onView,
  hasHeads = false,
}: {
  view: PurchaseView
  onView: (view: PurchaseView) => void
  hasHeads?: boolean
}) {
  return (
    <div role="group" aria-label="구매 요청 거르기" className="flex flex-wrap gap-2">
      {PURCHASE_VIEWS.filter(item => item !== 'department' || hasHeads || view === item).map(
        item => (
          <Button
            key={item}
            size="sm"
            touch
            className="break-keep"
            variant={view === item ? 'secondary' : 'outline'}
            aria-pressed={view === item}
            onClick={() => onView(item)}
          >
            {VIEW_LABEL[item]}
          </Button>
        ),
      )}
    </div>
  )
}
