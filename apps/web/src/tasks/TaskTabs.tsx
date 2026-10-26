import { CalendarDays, SquareKanban, Table2, X } from 'lucide-react'
import type { TaskFilter, TaskLayout, TaskView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

const TABS: { view: TaskView; label: string }[] = [
  { view: 'mine', label: '내 업무' },
  { view: 'department', label: '내 부서' },
  { view: 'all', label: '전체' },
  { view: 'unassigned', label: '담당자 없음' },
]
// 배치 고르기 '보드 · 표 · 달력'(DEC-94). 표의 주소 값은 018의 list 그대로다.
const LAYOUTS = [
  { layout: 'board', label: '보드', Icon: SquareKanban },
  { layout: 'list', label: '표', Icon: Table2 },
  { layout: 'calendar', label: '달력', Icon: CalendarDays },
] as const
const FILTERS: { filter: TaskFilter; label: string }[] = [
  { filter: 'open', label: '끝나지 않은 것' },
  { filter: 'done', label: '끝남' },
]

type Props = {
  // 행사의 업무 탭은 그 행사의 업무 전체만 보이므로 보기 탭이 없다.
  showViews?: boolean
  // 부서에 속하지 않은 사람(부서 없는 회장단 등)에게는 '내 부서' 탭이 없다.
  hasDepartment?: boolean
  view: TaskView
  filter: TaskFilter
  onView: (view: TaskView) => void
  onFilter: (filter: TaskFilter) => void
  // 보드·표·달력. 달력과 넓은 화면의 보드는 끝난 업무도 함께 보여 거르기가 없다(showFilter).
  layout?: { value: TaskLayout; onChange: (layout: TaskLayout) => void } | undefined
  showFilter?: boolean
  // 목록을 좁힌 조건(부서, 담당자 없음)과 그것을 푸는 동작
  narrow?: { label: string; onClear: () => void } | undefined
}

// 보드·표·달력 전환. 같은 업무를 다른 모양으로 보는 것이라 탭이 아니라 눌린 단추 묶음이다. 휴대폰은 탭과 한 줄에 두려고 그림만 보인다.
function LayoutSwitch({ value, onChange }: NonNullable<Props['layout']>) {
  return (
    <div role="group" aria-label="보기 모양" className="flex rounded-md border p-0.5">
      {LAYOUTS.map(({ layout, label, Icon }) => (
        <Button
          touch
          key={layout}
          size="sm"
          variant={value === layout ? 'secondary' : 'ghost'}
          aria-pressed={value === layout}
          className="py-1"
          onClick={() => onChange(layout)}
        >
          <Icon aria-hidden />
          <span className="sr-only sm:not-sr-only">{label}</span>
        </Button>
      ))}
    </div>
  )
}

// 탭 넷(내 업무, 내 부서, 전체, 담당자 없음)과 거르기 둘(끝나지 않은 것, 끝남), 보드·표·달력 전환. 거르기와 전환은 탭 줄 오른쪽에 두어 버튼 줄을 하나 줄인다.
export function TaskTabs(props: Props) {
  const { showViews = true, showFilter = true, view, filter, onView, onFilter, layout } = props
  const { narrow } = props
  const tabs = TABS.filter(tab => tab.view !== 'department' || props.hasDepartment)
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
      {showViews && (
        <div role="tablist" aria-label="업무 보기" className="flex">
          {tabs.map(tab => (
            <TabButton
              key={tab.view}
              className="px-3 sm:px-4"
              aria-selected={view === tab.view}
              onClick={() => onView(tab.view)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2 pb-2">
        {narrow && (
          <Button
            touch
            size="sm"
            variant="outline"
            className="h-auto max-w-full text-left wrap-anywhere whitespace-normal"
            aria-label={`${narrow.label} 거르기 풀기`}
            onClick={narrow.onClear}
          >
            {narrow.label}
            <X aria-hidden />
          </Button>
        )}
        {showFilter && (
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
        )}
        {layout && <LayoutSwitch {...layout} />}
      </div>
    </div>
  )
}
