import type { FinanceTab } from '@vada/contracts'
import { TabButton } from '@/components/ui/tab-button'

export type { FinanceTab }

type TabsProps = {
  tab: FinanceTab
  onTab: (tab: FinanceTab) => void
  // 납부자 명단 탭은 `fee_payment.view`가 있는 재정부와 회장단에게만 보인다.
  showFees: boolean
}

// 예산 현황은 모든 운영진의 첫 탭이다(메뉴 v7 S6a).
export function FinanceTabs({ tab, onTab, showFees }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="재정 보기"
      className="flex flex-wrap border-b break-keep [&>button]:max-sm:min-h-11"
    >
      <TabButton aria-selected={tab === 'overview'} onClick={() => onTab('overview')}>
        예산 현황
      </TabButton>
      <TabButton aria-selected={tab === 'ledger'} onClick={() => onTab('ledger')}>
        사용 내역
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
