import { useMemo } from 'react'
import {
  koreanDateOf,
  type CouncilView,
  type TeamResponse,
  type TaskSummary,
} from '@vada/contracts'
import { useNow } from '@/lib/use-now'
import { recalledDepartment } from '@/lib/menu-memory'
import {
  homeScopeActive,
  homeScopeLabel,
  inHomeTaskScope,
  type HomeTaskScope,
} from './home-task-scope'
import { useTasks, type TaskList } from './useTasks'
import { chipCounts, matchesTaskChips, type TaskChipCounts, type TaskChipScope } from './task-chips'
import { BOARD_SCOPE, CHIP_LABEL, NO_DEPARTMENT } from './task-chip-text'
import type { useTaskControls } from './useTaskControls'

// 부서를 고른 보기는 그 부서의 업무만 남긴다(홈의 부서 줄이 연다).
// 새 배열이 렌더마다 만들어지면 표가 목록이 바뀐 줄로 알고 고른 값을 지우므로, 읽은 목록이 바뀔 때만 다시 만든다.
export function useNarrowed(
  list: TaskList,
  department: string | null,
  scope: HomeTaskScope & TaskChipScope,
  council: CouncilView,
): TaskList {
  const { state, reload } = list
  const today = koreanDateOf(useNow())
  const { heads, attention, week, assignee, due, view } = scope
  return useMemo(() => {
    if (state.kind !== 'ready') return { state, reload }
    const tasks = state.tasks.filter(
      task =>
        matchesTaskChips(task, department, { due, view }, council.me.memberId) &&
        inHomeTaskScope(task, { heads, attention, week, assignee }, council, today),
    )
    return { reload, state: { ...state, tasks } }
  }, [state, reload, department, heads, attention, week, assignee, due, view, council, today])
}

export type TaskChipData = {
  counts: TaskChipCounts | null
  truncated: boolean
  departments: { id: string; name: string }[]
  members: { id: string; name: string }[]
}
type Controls = ReturnType<typeof useTaskControls>

type ChipSource = TaskChipData & { tasks: TaskSummary[] }

function departmentLabel(id: string | null, council: CouncilView, data: ChipSource) {
  if (id === null) return null
  if (id === 'none') return NO_DEPARTMENT
  const departments = [
    ...data.departments,
    ...council.me.departments,
    ...data.tasks.flatMap(task => (task.department ? [task.department] : [])),
  ]
  return departments.find(dept => dept.id === id)?.name ?? recalledDepartment(id) ?? '부서'
}

function homeLabel(controls: Controls, data: ChipSource) {
  if (!homeScopeActive(controls)) return ''
  const home = homeScopeLabel(controls, data.tasks)
  const who = data.members.find(member => member.id === controls.assignee)?.name
  const known = data.tasks.some(task => task.assignee?.id === controls.assignee)
  return who && !known ? home.replace('담당자', who) : home
}

// 홈 범위와 보드 조건을 한 띠에 합쳐, 한쪽을 다른 쪽의 안내로 가리지 않는다.
function narrowLabel(controls: Controls, council: CouncilView, data: ChipSource) {
  return [
    controls.view === 'mine' ? BOARD_SCOPE.mine : null,
    controls.due === 'overdue' ? CHIP_LABEL.overdue : null,
    controls.due === 'none' ? CHIP_LABEL.noDue : null,
    departmentLabel(controls.dept, council, data),
    homeLabel(controls, data),
  ]
    .filter(Boolean)
    .join(' · ')
}

function chipSource(
  state: TaskList['state'],
  controls: Controls,
  memberId: string,
  team: TeamResponse | null,
): ChipSource {
  const tasks = state.kind === 'ready' ? state.tasks : []
  const departments = team?.departments ?? []
  const eventDepartments = new Set(
    tasks.filter(task => task.status !== 'done').map(task => task.department?.id),
  )
  return {
    tasks,
    counts: state.kind === 'ready' ? chipCounts(tasks, memberId) : null,
    truncated: state.kind === 'ready' && state.truncated,
    departments: controls.inMenu
      ? departments
      : departments.filter(dept => eventDepartments.has(dept.id)),
    members: team?.members ?? [],
  }
}

// 표의 끝남을 보더라도 칩 수는 열린 업무에서 센다. 기본 목록이 열림이면 같은 응답을 다시 쓴다.
export function useTaskChipData(
  lists: { list: TaskList; both: boolean },
  controls: Controls,
  props: { view: CouncilView; onForbidden: () => void },
  team: TeamResponse | null,
) {
  const extra = !lists.both && controls.filter === 'done'
  const open = useTasks(
    props.view.council.id,
    { view: 'all', filter: 'open', eventId: controls.listEvent },
    props.onForbidden,
    extra,
  )
  const { state } = extra ? open : lists.list
  const data = chipSource(state, controls, props.view.me.memberId, team)
  const label = narrowLabel(controls, props.view, data)
  return { data, narrow: label ? { label, onClear: controls.clearNarrow } : undefined }
}
