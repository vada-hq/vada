import type { FinanceTab } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { TabButton } from '@/components/ui/tab-button'
import { FINANCE_TAB_LABELS, FINANCE_TITLE, financeTrail } from './finance-text'

export type { FinanceTab }

type TabsProps = {
  tab: FinanceTab
  onTab: (tab: FinanceTab) => void
}

// 예산 현황은 모든 운영진의 첫 탭이다(메뉴 v7 S6a).
export function FinanceTabs({ tab, onTab }: TabsProps) {
  return (
    <>
      <PageHeading trail={financeTrail(tab)}>
        <span className="sr-only">{FINANCE_TITLE}</span>
      </PageHeading>
      <div
        role="tablist"
        aria-label="재정 보기"
        className="flex flex-wrap border-b break-keep [&>button]:max-sm:min-h-11"
      >
        <TabButton aria-selected={tab === 'overview'} onClick={() => onTab('overview')}>
          {FINANCE_TAB_LABELS.overview}
        </TabButton>
        <TabButton aria-selected={tab === 'ledger'} onClick={() => onTab('ledger')}>
          {FINANCE_TAB_LABELS.ledger}
        </TabButton>
        <TabButton aria-selected={tab === 'closing'} onClick={() => onTab('closing')}>
          {FINANCE_TAB_LABELS.closing}
        </TabButton>
      </div>
    </>
  )
}
