import type { TaskView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { useTaskControls } from './useTaskControls'
import type { TaskChipData } from './useNarrowedTasks'
import {
  ALL_ASSIGNEES,
  ASSIGNEE_FILTER,
  BOARD_SCOPE,
  CHIP_LABEL,
  COUNT_PENDING,
  INCLUDE_EVENTS,
  NO_DEPARTMENT,
} from './task-chip-text'

type Scope = Pick<
  ReturnType<typeof useTaskControls>,
  | 'dept'
  | 'due'
  | 'assignee'
  | 'inMenu'
  | 'includeEvents'
  | 'setDept'
  | 'toggleChip'
  | 'toggleEvents'
  | 'setAssignee'
>
type Props = {
  scope: Scope
  data?: TaskChipData | undefined
  view: TaskView
  onView: (view: TaskView) => void
  // 달력은 '마감 없음 N'을 따로 두므로 같은 이름의 칩을 한 화면에 두지 않는다.
  calendar?: boolean | undefined
}
const EMPTY: TaskChipData = { counts: null, truncated: false, departments: [], members: [] }

function BoardScope({ view, onView }: Pick<Props, 'view' | 'onView'>) {
  return (
    <div role="group" aria-label="보드 업무 범위" className="flex shrink-0 rounded-md border p-0.5">
      {(['all', 'mine'] as const).map(value => (
        <Button
          key={value}
          size="sm"
          variant={view === value ? 'secondary' : 'ghost'}
          aria-pressed={view === value}
          className="max-sm:min-h-11"
          onClick={() => onView(value)}
        >
          {BOARD_SCOPE[value]}
        </Button>
      ))}
    </div>
  )
}

function CountChips({
  scope,
  data,
  calendar,
}: {
  scope: Scope
  data: TaskChipData
  calendar?: boolean | undefined
}) {
  const { counts, truncated } = data
  const count = (key: keyof NonNullable<TaskChipData['counts']>) =>
    counts === null ? COUNT_PENDING : `${counts[key]}${truncated ? '+' : ''}`
  return (
    <>
      {counts !== null && counts.overdue > 0 && (
        <Button
          size="sm"
          variant="outline"
          aria-pressed={scope.due === 'overdue'}
          className={cn(
            'shrink-0 rounded-full text-red-600 max-sm:min-h-11',
            scope.due === 'overdue' && 'border-red-300 bg-red-50',
          )}
          onClick={() => scope.toggleChip('overdue')}
        >
          {CHIP_LABEL.overdue} <span className="tabular-nums">{count('overdue')}</span>
        </Button>
      )}
      <span className="shrink-0 text-sm text-muted-foreground">
        {CHIP_LABEL.mine} <span className="tabular-nums">{count('mine')}</span>
      </span>
      <Button
        size="sm"
        variant={scope.assignee === 'none' ? 'secondary' : 'outline'}
        aria-pressed={scope.assignee === 'none'}
        className="shrink-0 rounded-full text-muted-foreground max-sm:min-h-11"
        onClick={() => scope.toggleChip('unassigned')}
      >
        {CHIP_LABEL.unassigned} <span className="tabular-nums">{count('unassigned')}</span>
      </Button>
      {!calendar && counts !== null && counts.noDue > 0 && (
        <Button
          size="sm"
          variant={scope.due === 'none' ? 'secondary' : 'outline'}
          aria-pressed={scope.due === 'none'}
          className="shrink-0 rounded-full max-sm:min-h-11"
          onClick={() => scope.toggleChip('none')}
        >
          {CHIP_LABEL.noDue} <span className="tabular-nums">{count('noDue')}</span>
        </Button>
      )}
    </>
  )
}

// 작은 화면에서는 줄 전체를 가로로 넘기고, 넓은 화면에서는 부서가 많아도 본문 안에서 접어 놓는다.
export function TaskScopeChips({ scope, data = EMPTY, view, onView, calendar }: Props) {
  const departments = scope.inMenu
    ? [...data.departments, { id: 'none', name: NO_DEPARTMENT }]
    : data.departments
  return (
    <div
      role="group"
      aria-label="업무 범위"
      className="flex min-w-0 max-w-full flex-wrap items-center gap-2 break-keep pb-1 max-sm:flex-nowrap max-sm:overflow-x-auto"
    >
      <BoardScope view={view} onView={onView} />
      <CountChips scope={scope} data={data} calendar={calendar} />
      {departments.map(dept => (
        <Button
          key={dept.id}
          size="sm"
          variant={scope.dept === dept.id ? 'secondary' : 'outline'}
          aria-pressed={scope.dept === dept.id}
          className="h-auto min-h-8 max-w-48 shrink-0 rounded-full text-left wrap-anywhere whitespace-normal max-sm:min-h-11"
          onClick={() => scope.setDept(scope.dept === dept.id ? null : dept.id)}
        >
          {dept.name}
        </Button>
      ))}
      <NativeSelect
        aria-label={ASSIGNEE_FILTER}
        value={scope.assignee === 'none' ? '' : (scope.assignee ?? '')}
        className="w-36 shrink-0 max-sm:min-h-11"
        onChange={event => scope.setAssignee(event.target.value || null)}
      >
        <option value="">{ALL_ASSIGNEES}</option>
        {data.members.map(member => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </NativeSelect>
      {scope.inMenu && (
        <Button
          size="sm"
          variant={scope.includeEvents ? 'secondary' : 'outline'}
          aria-pressed={scope.includeEvents}
          className="shrink-0 rounded-full max-sm:min-h-11"
          onClick={scope.toggleEvents}
        >
          {INCLUDE_EVENTS}
        </Button>
      )}
    </div>
  )
}
