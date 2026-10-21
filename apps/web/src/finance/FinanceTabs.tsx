import { PURCHASE_VIEWS, type PurchaseView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { VIEW_LABEL } from './purchase-view'

// 탭은 구매 요청 하나다. 지출과 예산 탭은 그 화면을 만드는 조각(7·8)에서 더한다.
export function FinanceTabs({
  view,
  onView,
}: {
  view: PurchaseView
  onView: (view: PurchaseView) => void
}) {
  return (
    <>
      <div role="tablist" aria-label="재정 보기" className="flex border-b">
        <TabButton aria-selected>구매 요청</TabButton>
      </div>
      <div role="group" aria-label="구매 요청 거르기" className="flex flex-wrap gap-2">
        {PURCHASE_VIEWS.map(item => (
          <Button
            key={item}
            size="sm"
            variant={view === item ? 'secondary' : 'outline'}
            aria-pressed={view === item}
            onClick={() => onView(item)}
          >
            {VIEW_LABEL[item]}
          </Button>
        ))}
      </div>
    </>
  )
}
