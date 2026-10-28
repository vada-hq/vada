import type { PeopleTab } from '@vada/contracts'
import { TabButton } from '@/components/ui/tab-button'

export const PEOPLE_TAB_LABELS: Record<PeopleTab, string> = {
  people: '부서 및 구성원',
  fees: '납부자 명단',
}

export function OrganizationTabs({
  tab,
  onTab,
}: {
  tab: PeopleTab
  onTab: (tab: PeopleTab) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="조직 보기"
      className="flex flex-wrap border-b break-keep [&>button]:max-sm:min-h-11"
    >
      <TabButton aria-selected={tab === 'people'} onClick={() => onTab('people')}>
        {PEOPLE_TAB_LABELS.people}
      </TabButton>
      <TabButton aria-selected={tab === 'fees'} onClick={() => onTab('fees')}>
        {PEOPLE_TAB_LABELS.fees}
      </TabButton>
    </div>
  )
}
