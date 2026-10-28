import type { PurchaseView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { STATUS_LABEL } from '@/finance/purchase-view'
const VIEWS: PurchaseView[] = ['all', 'mine', 'pending', 'department']
const LABEL: Record<PurchaseView, string> = {
  all: '전체 요청',
  mine: '내 요청',
  pending: STATUS_LABEL.pending,
  department: '내 부서',
}

export function RequestFilter({
  view,
  onView,
  canViewDepartment = false,
}: {
  view: PurchaseView
  onView: (view: PurchaseView) => void
  canViewDepartment?: boolean
}) {
  return (
    <div role="group" aria-label="구매 요청 거르기" className="flex flex-wrap gap-2">
      {VIEWS.filter(item => item !== 'department' || canViewDepartment || view === item).map(
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
            {LABEL[item]}
          </Button>
        ),
      )}
    </div>
  )
}
