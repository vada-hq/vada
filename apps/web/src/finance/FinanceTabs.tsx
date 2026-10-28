import type { FinanceTab } from '@vada/contracts'
import { TabButton } from '@/components/ui/tab-button'

export type { FinanceTab }

type TabsProps = {
  tab: FinanceTab
  onTab: (tab: FinanceTab) => void
}

// 예산 현황은 모든 운영진의 첫 탭이다(메뉴 v7 S6a).
export function FinanceTabs({ tab, onTab }: TabsProps) {
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
      <TabButton aria-selected={tab === 'closing'} onClick={() => onTab('closing')}>
        결산
      </TabButton>
    </div>
  )
}
