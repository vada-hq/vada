import { PURCHASE_VIEWS, type FinanceTab, type PurchaseView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { VIEW_LABEL } from './purchase-view'

export type { FinanceTab }

type TabsProps = {
  tab: FinanceTab
  onTab: (tab: FinanceTab) => void
  // 납부자 명단 탭은 `fee_payment.view`가 있는 재정부와 회장단에게만 보인다.
  showFees: boolean
  // 개요 탭은 공개 전 결산을 읽을 수 있는 재정부(`finance.manage`)에게만 보인다.
  showOverview: boolean
}

export function FinanceTabs({ tab, onTab, showFees, showOverview }: TabsProps) {
  return (
    // 탭이 아홉이라 390px에서 한 줄에 다 들어가지 않는다. 탭 부품은 부모에 overflow를 주지 못하므로(tab-button.tsx) 넘치면 줄을 바꾼다.
    <div role="tablist" aria-label="재정 보기" className="flex flex-wrap border-b">
      {showOverview && (
        <TabButton aria-selected={tab === 'overview'} onClick={() => onTab('overview')}>
          개요
        </TabButton>
      )}
      <TabButton aria-selected={tab === 'requests'} onClick={() => onTab('requests')}>
        구매 요청
      </TabButton>
      <TabButton aria-selected={tab === 'expenses'} onClick={() => onTab('expenses')}>
        지출
      </TabButton>
      <TabButton aria-selected={tab === 'incomes'} onClick={() => onTab('incomes')}>
        수입
      </TabButton>
      <TabButton aria-selected={tab === 'budget'} onClick={() => onTab('budget')}>
        예산
      </TabButton>
      <TabButton aria-selected={tab === 'settlements'} onClick={() => onTab('settlements')}>
        행사 정산
      </TabButton>
      <TabButton aria-selected={tab === 'accounts'} onClick={() => onTab('accounts')}>
        계좌
      </TabButton>
      {showFees && (
        <TabButton aria-selected={tab === 'fees'} onClick={() => onTab('fees')}>
          납부자 명단
        </TabButton>
      )}
      <TabButton aria-selected={tab === 'closing'} onClick={() => onTab('closing')}>
        결산
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
