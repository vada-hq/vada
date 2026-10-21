import { PURCHASE_VIEWS, type PurchaseView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { VIEW_LABEL } from './purchase-view'

// 지출 탭은 그 화면을 만드는 조각(8)에서 더한다.
export type FinanceTab = 'requests' | 'budget'

export function FinanceTabs({ tab, onTab }: { tab: FinanceTab; onTab: (tab: FinanceTab) => void }) {
  return (
    <div role="tablist" aria-label="재정 보기" className="flex border-b">
      <TabButton aria-selected={tab === 'requests'} onClick={() => onTab('requests')}>
        구매 요청
      </TabButton>
      <TabButton aria-selected={tab === 'budget'} onClick={() => onTab('budget')}>
        예산
      </TabButton>
    </div>
  )
}

// 구매 요청 탭의 거르기(내 요청, 결재 대기, 전체)
export function RequestFilter({
  view,
  onView,
}: {
  view: PurchaseView
  onView: (view: PurchaseView) => void
}) {
  return (
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
  )
}
