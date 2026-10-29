import type { MeetingTab } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { TabButton } from '@/components/ui/tab-button'

const TABS: { tab: MeetingTab; label: string }[] = [
  { tab: 'council', label: '학생회 회의' },
  { tab: 'mine', label: '내 회의' },
]

// 회의 메뉴의 탭 둘(M-24, MEET-MY-01). 업무 메뉴의 탭 둘과 같은 모양이다(TaskTabs).
export function MeetingTabs({ tab, onTab }: { tab: MeetingTab; onTab: (tab: MeetingTab) => void }) {
  const title = TABS.find(item => item.tab === tab)?.label ?? '학생회 회의'
  return (
    <>
      <PageHeading trail={{ title, crumbs: [{ label: title, truncate: false }] }}>
        <h1 className="text-xl font-semibold">{title}</h1>
      </PageHeading>
      <div role="tablist" aria-label="회의 보기" className="flex border-b">
        {TABS.map(item => (
          <TabButton
            key={item.tab}
            className="px-3 max-sm:min-h-11 sm:px-4"
            aria-selected={tab === item.tab}
            onClick={() => onTab(item.tab)}
          >
            {item.label}
          </TabButton>
        ))}
      </div>
    </>
  )
}
