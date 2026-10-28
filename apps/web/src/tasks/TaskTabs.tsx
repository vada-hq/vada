import { CalendarDays, SquareKanban, Table2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { TaskFilter, TaskLayout, TaskTab, TaskView } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { TaskScopeChips } from './TaskScopeChips'
import { CLEAR_FILTERS, filteredTasksText } from './task-chip-text'

const TABS: { tab: TaskTab; label: string }[] = [
  { tab: 'council', label: '학생회 업무' },
  { tab: 'mine', label: '내 업무' },
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
  tab?: { value: TaskTab; onChange: (tab: TaskTab) => void } | undefined
  scope: ComponentProps<typeof TaskScopeChips>['scope']
  chips?: ComponentProps<typeof TaskScopeChips>['data']
  view: TaskView
  filter: TaskFilter
  onView: (view: TaskView) => void
  onFilter: (filter: TaskFilter) => void
  // 보드·표·달력. 달력과 넓은 화면의 보드는 끝난 업무도 함께 보여 거르기가 없다(showFilter).
  layout?: { value: TaskLayout; onChange: (layout: TaskLayout) => void } | undefined
  showFilter?: boolean
  // 목록을 좁힌 조건(부서, 담당자 없음)과 그것을 푸는 동작
  narrow?: { label: string; onClear: () => void } | undefined
  allowCalendar?: boolean | undefined
}

// 보드·표·달력 전환. 같은 업무를 다른 모양으로 보는 것이라 탭이 아니라 눌린 단추 묶음이다. 휴대폰은 탭과 한 줄에 두려고 그림만 보인다.
function LayoutSwitch({
  value,
  onChange,
  allowCalendar,
}: NonNullable<Props['layout']> & Pick<Props, 'allowCalendar'>) {
  return (
    <div role="group" aria-label="보기 모양" className="flex rounded-md border p-0.5">
      {LAYOUTS.filter(item => item.layout !== 'calendar' || allowCalendar).map(
        ({ layout, label, Icon }) => (
          <Button
            key={layout}
            size="sm"
            variant={value === layout ? 'secondary' : 'ghost'}
            aria-pressed={value === layout}
            className="py-1 max-sm:min-h-11"
            onClick={() => onChange(layout)}
          >
            <Icon aria-hidden />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </Button>
        ),
      )}
    </div>
  )
}

function menuTitle(tab: Props['tab']) {
  return TABS.find(item => item.tab === tab?.value)?.label ?? '학생회 업무'
}

export function TaskFilterBand({ label, onClear }: NonNullable<Props['narrow']>) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted px-3 py-1 text-sm break-keep">
      <span className="wrap-anywhere">{filteredTasksText(label)}</span>
      <Button size="sm" variant="ghost" className="shrink-0 max-sm:min-h-11" onClick={onClear}>
        {CLEAR_FILTERS}
      </Button>
    </div>
  )
}

// 메뉴 탭 둘과 보드의 거르기는 다른 줄이다. 행사 안에서는 메뉴 탭 없이 같은 보드 거르기만 쓴다.
export function TaskTabs(props: Props) {
  const { tab, showFilter = true, view, filter, onView, onFilter, layout } = props
  const { narrow } = props
  const title = menuTitle(tab)
  return (
    <div className="flex min-w-0 flex-col gap-3 break-keep">
      {tab && (
        <PageHeading trail={{ title, crumbs: [{ label: title, truncate: false }] }}>
          <span className="sr-only">{title}</span>
        </PageHeading>
      )}
      {tab && (
        <div role="tablist" aria-label="업무 보기" className="flex border-b">
          {TABS.map(item => (
            <TabButton
              key={item.tab}
              className="px-3 max-sm:min-h-11 sm:px-4"
              aria-selected={tab.value === item.tab}
              onClick={() => tab.onChange(item.tab)}
            >
              {item.label}
            </TabButton>
          ))}
        </div>
      )}
      {(tab === undefined || tab.value === 'council') && (
        <TaskScopeChips
          scope={props.scope}
          data={props.chips}
          view={view}
          onView={onView}
          calendar={layout?.value === 'calendar'}
        />
      )}
      {narrow && <TaskFilterBand {...narrow} />}
      <div className="ml-auto flex flex-wrap items-center gap-2 pb-2">
        {showFilter && (
          <div role="group" aria-label="업무 거르기" className="flex gap-2">
            {FILTERS.map(item => (
              <Button
                key={item.filter}
                size="sm"
                variant={filter === item.filter ? 'secondary' : 'outline'}
                aria-pressed={filter === item.filter}
                className="max-sm:min-h-11"
                onClick={() => onFilter(item.filter)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
        {layout && <LayoutSwitch {...layout} allowCalendar={props.allowCalendar} />}
      </div>
    </div>
  )
}
