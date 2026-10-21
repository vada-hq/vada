import type { TaskFilter, TaskView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

const TABS: { view: TaskView; label: string }[] = [
  { view: 'mine', label: '내 업무' },
  { view: 'all', label: '전체' },
  { view: 'unassigned', label: '담당자 없음' },
]
const FILTERS: { filter: TaskFilter; label: string }[] = [
  { filter: 'open', label: '끝나지 않은 것' },
  { filter: 'done', label: '끝남' },
]

type Props = {
  view: TaskView
  filter: TaskFilter
  onView: (view: TaskView) => void
  onFilter: (filter: TaskFilter) => void
}

// 탭 셋(내 업무, 전체, 담당자 없음)과 거르기 둘(끝나지 않은 것, 끝남)
export function TaskTabs({ view, filter, onView, onFilter }: Props) {
  return (
    <>
      <div role="tablist" aria-label="업무 보기" className="flex overflow-x-auto border-b">
        {TABS.map(tab => (
          <TabButton
            key={tab.view}
            aria-selected={view === tab.view}
            onClick={() => onView(tab.view)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>
      <div role="group" aria-label="업무 거르기" className="flex gap-2">
        {FILTERS.map(item => (
          <Button
            key={item.filter}
            size="sm"
            variant={filter === item.filter ? 'secondary' : 'outline'}
            aria-pressed={filter === item.filter}
            onClick={() => onFilter(item.filter)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </>
  )
}
