import type { CouncilView, TaskCreateOptionsResponse, TaskDetail, TaskView } from '@vada/contracts'
import { isUnassignedTask } from './task-unassigned'

// 빠른 추가가 새 업무의 자리를 정하는 데 쓰는, 지금 보는 곳.
export type QuickAddContext = {
  view: CouncilView
  taskView: TaskView
  // 부서 거르기. 없으면 null, '부서 없음' 칩이면 'none'
  dept: string | null
  // 행사의 업무 탭이면 그 행사
  eventId: string | undefined
}

// '부서 없음' 칩의 주소 값(contracts paths.ts의 dept also). 부서 없는 업무는 학생회 업무다.
const NO_DEPT = 'none'

export type Placement = { departmentId: string | null; assigneeId: string | null }

// 부서를 바꿔도 고른 사람이 있으면 남기고, 없으면 나, 없으면 서버의 첫 선택지다.
export function selectAssignee(
  assignees: TaskCreateOptionsResponse['departments'][number]['assignees'],
  wanted: string | null,
  me: string,
): string | null {
  if (assignees.some(item => item.id === wanted)) return wanted
  if (assignees.some(item => item.id === me)) return me
  return assignees[0]?.id ?? null
}

// 보는 곳에서 바라는 부서: 부서 거르기, 회장단이면 학생회 업무, 그 밖은 내 부서 가운데 부장인 부서 먼저 첫 것.
function wantedDepartment({ view, dept }: QuickAddContext): string | null {
  if (dept !== null) return dept === NO_DEPT ? null : dept
  if (view.me.councilRank !== null) return null
  const mine = view.me.departments
  return (mine.find(item => item.rank !== null) ?? mine[0])?.id ?? null
}

// 부서 업무를 바라는 사람이 행사의 업무 탭에서 고를 부서가 없으면(그 행사에 이을 부서가 없다, DEC-94) 만들 자리가 없다.
// 학생회 업무로 돌려 만들면 뜻과 다른 곳에 생긴다. 학생회 업무를 바라는 사람(회장단, 부서 없는 운영진)은 그대로다.
const noDepartmentForEvent = (
  options: TaskCreateOptionsResponse,
  context: QuickAddContext,
  wanted: string | null,
) =>
  context.eventId !== undefined &&
  wanted !== null &&
  !options.departments.some(item => item.id !== null)

// 새 업무의 부서와 담당자. 바라는 값이 서버 선택지에 없으면 선택지의 첫 부서,
// 담당자는 그 부서 선택지에 '나'가 있으면 나, 없으면 첫 값이다. 화면은 선택지 안에서 고르기만 한다(DEC-38).
export function defaultPlacement(
  options: TaskCreateOptionsResponse,
  context: QuickAddContext,
): Placement | null {
  const wanted = wantedDepartment(context)
  if (noDepartmentForEvent(options, context, wanted)) return null
  const department = options.departments.find(item => item.id === wanted) ?? options.departments[0]
  if (!department) return null
  const me = context.view.me.memberId
  const wantedAssignee = context.taskView === 'mine' ? me : null
  const assigneeId = selectAssignee(department.assignees, wantedAssignee, me)
  return { departmentId: department.id, assigneeId }
}

// 보기 탭이 받아들이는 업무인가.
function inTab(
  task: Pick<TaskDetail, 'department' | 'assignee' | 'status'>,
  view: CouncilView,
  tab: TaskView,
) {
  if (tab === 'mine') return task.assignee?.id === view.me.memberId
  if (tab === 'unassigned') return isUnassignedTask(task)
  if (tab === 'department') return view.me.departments.some(item => item.id === task.department?.id)
  return true
}

// 만든 업무가 지금 보기에 보이는가(행사, 부서 거르기, 보기 탭). 아니면 빠른 추가가 그렇다고 알린다.
export function visibleInView(
  task: Pick<TaskDetail, 'department' | 'assignee' | 'event' | 'status'>,
  { view, taskView, dept, eventId }: QuickAddContext,
): boolean {
  if (eventId !== undefined && task.event?.id !== eventId) return false
  if (dept === NO_DEPT ? task.department !== null : dept !== null && task.department?.id !== dept)
    return false
  return inTab(task, view, taskView)
}
