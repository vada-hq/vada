import {
  TASK_NARROW_KEYS,
  type CouncilView,
  type TeamResponse,
  type TaskSummary,
} from '@vada/contracts'
import { recalledDepartment } from '@/lib/menu-memory'
import type { TaskNarrow } from './task-api'
import { homeScopeActive, homeScopeLabel } from './home-task-scope'
import { useTasks, type TaskList } from './useTasks'
import { chipCounts, type TaskChipCounts } from './task-chips'
import { BOARD_SCOPE, CHIP_LABEL, MY_DEPARTMENT, NO_DEPARTMENT } from './task-chip-text'
import type { useTaskControls } from './useTaskControls'

type Controls = ReturnType<typeof useTaskControls>

// 칩·홈 범위(부서, 마감, 담당자, 확인 필요, 직급 부서)는 서버가 목록 상한 전에 거른다. 화면은 다시 거르지 않는다.
// 담당자 없음은 보기가 unassigned이면 이미 실었으므로 겹쳐 보내지 않는다(내 업무·옛 내 부서 보기와는 겹쳐 보낸다).
export function listNarrowOf(controls: Controls): TaskNarrow {
  const unassignedView = controls.listView === 'unassigned' && controls.assignee === 'none'
  return {
    dept: controls.dept,
    due: controls.due,
    assignee: unassignedView ? null : controls.assignee,
    attention: controls.attention ? 'true' : null,
    heads: controls.heads ? 'true' : null,
  }
}

export const isNarrowed = (narrow: TaskNarrow) => TASK_NARROW_KEYS.some(key => narrow[key])

export type TaskChipData = {
  counts: TaskChipCounts | null
  truncated: boolean
  departments: { id: string; name: string }[]
  members: { id: string; name: string }[]
}

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
    controls.view === 'department' ? MY_DEPARTMENT : null,
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

// 표의 끝남이나 서버가 거른 목록을 보더라도 칩 수는 전체 열린 업무에서 센다. 기본 목록이 거르지 않은 전체·열림이면 같은 응답을 다시 쓴다.
// 따로 읽을 때는 업무를 바꾼 뒤 그 목록도 다시 읽는다(reload).
export function useTaskChipData(
  lists: { list: TaskList; both: boolean },
  controls: Controls,
  props: { view: CouncilView; onForbidden: () => void },
  team: TeamResponse | null,
) {
  const extra =
    controls.listView !== 'all' ||
    isNarrowed(listNarrowOf(controls)) ||
    (!lists.both && controls.filter === 'done')
  const open = useTasks(
    props.view.council.id,
    { view: 'all', filter: 'open', eventId: controls.listEvent },
    props.onForbidden,
    extra,
  )
  const { state } = extra ? open : lists.list
  const data = chipSource(state, controls, props.view.me.memberId, team)
  const label = narrowLabel(controls, props.view, data)
  return {
    data,
    narrow: label ? { label, onClear: controls.clearNarrow } : undefined,
    reload: async () => (extra ? open.reload() : undefined),
  }
}
