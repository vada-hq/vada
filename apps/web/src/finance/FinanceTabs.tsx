import type { FinanceTab } from '@vada/contracts'
import { TabButton } from '@/components/ui/tab-button'

export type { FinanceTab }
type VisibleFinanceTab = Exclude<FinanceTab, 'requests'>

type TabsProps = {
  tab: VisibleFinanceTab
  onTab: (tab: VisibleFinanceTab) => void
  // 납부자 명단 탭은 `fee_payment.view`가 있는 재정부와 회장단에게만 보인다.
  showFees: boolean
}

// 개요는 모든 운영진의 첫 탭이다(DEC-92).
export function FinanceTabs({ tab, onTab, showFees }: TabsProps) {
  return (
    // 390px에서 한 줄에 다 들어가지 않아 넘치면 줄을 바꾼다.
    <div role="tablist" aria-label="재정 보기" className="flex flex-wrap border-b">
      <TabButton aria-selected={tab === 'overview'} onClick={() => onTab('overview')}>
        개요
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
