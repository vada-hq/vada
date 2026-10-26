import { useId, type ReactNode } from 'react'
import { COUNCIL_TABS, type CouncilTab } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { TabButton } from '@/components/ui/tab-button'

const LABEL: Record<CouncilTab, string> = { messages: '메시지', tasks: '업무' }

// 우리 학생회 공간의 틀(US-MSG-01·OPS-TASK-01). 머리글 바로 아래 밑줄 탭 줄이고 본문은 같은 왼쪽 줄이다.
// 화면이 생기는 순서대로 탭을 더한다(DEC-96). 메시지 방 전환과 재정은 각각 028 조각 6·9가 잇는다.
export default function CouncilSpace({
  tab,
  onTab,
  children,
}: {
  tab: CouncilTab
  onTab: (tab: CouncilTab) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeading
        trail={{ title: '우리 학생회', crumbs: [{ label: LABEL[tab], truncate: false }] }}
      >
        <h2 className="text-xl font-semibold">우리 학생회</h2>
      </PageHeading>
      <div
        role="tablist"
        aria-label="우리 학생회 보기"
        className="flex shrink-0 border-b bg-white px-4 sm:px-6"
      >
        {COUNCIL_TABS.map(item => (
          <TabButton
            key={item}
            id={`${id}-${item}`}
            aria-selected={tab === item}
            aria-controls={`${id}-panel`}
            className="min-h-11 break-keep"
            onClick={() => onTab(item)}
          >
            {LABEL[item]}
          </TabButton>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        className="min-h-0 flex-1 p-4 sm:p-6"
      >
        {children}
      </div>
    </div>
  )
}
