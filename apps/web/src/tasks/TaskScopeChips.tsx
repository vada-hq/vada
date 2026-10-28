import type { TaskView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import type { useTaskControls } from './useTaskControls'

type Scope = Pick<
  ReturnType<typeof useTaskControls>,
  'dept' | 'assignee' | 'inMenu' | 'includeEvents' | 'setDept' | 'toggleUnassigned' | 'toggleEvents'
>
type Props = {
  scope: Scope
  myDepartment?: string | undefined
  view: TaskView
  onView: (view: TaskView) => void
}

// 칩 셋은 옛 보기의 범위를 유지한다(S4). 행사 안에서는 범위가 이미 정해져 행사 포함 칩을 두지 않는다.
export function TaskScopeChips({ scope, myDepartment, view, onView }: Props) {
  const chips = [
    ...(myDepartment
      ? [
          {
            label: '내 부서',
            selected: scope.dept === myDepartment,
            onClick: () => scope.setDept(scope.dept === myDepartment ? null : myDepartment),
          },
        ]
      : []),
    {
      label: '담당자 없음',
      selected: scope.assignee === 'none' || view === 'unassigned',
      onClick: scope.toggleUnassigned,
    },
    ...(scope.inMenu
      ? [{ label: '행사 업무 포함', selected: scope.includeEvents, onClick: scope.toggleEvents }]
      : []),
  ]
  return (
    <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto pb-1">
      <div role="group" aria-label="업무 범위" className="flex shrink-0 gap-2">
        {chips.map(chip => (
          <Button
            key={chip.label}
            size="sm"
            variant={chip.selected ? 'secondary' : 'outline'}
            aria-pressed={chip.selected}
            className="rounded-full max-sm:min-h-11"
            onClick={chip.onClick}
          >
            {chip.label}
          </Button>
        ))}
      </div>
      {!scope.inMenu && (
        <div role="group" aria-label="보드 업무 범위" className="ml-auto flex shrink-0 gap-1">
          {(['all', 'mine'] as const).map(value => (
            <Button
              key={value}
              size="sm"
              variant={view === value ? 'secondary' : 'ghost'}
              aria-pressed={view === value}
              className="max-sm:min-h-11"
              onClick={() => onView(value)}
            >
              {value === 'all' ? '전체 업무' : '내 업무'}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
