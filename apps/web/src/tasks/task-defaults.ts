import type { CouncilView, TaskCreateOptionsResponse, TaskDetail, TaskView } from '@vada/contracts'

// 빠른 추가가 새 업무의 자리를 정하는 데 쓰는, 지금 보는 곳.
export type QuickAddContext = {
  view: CouncilView
  taskView: TaskView
  // 부서 거르기. 없으면 null
  dept: string | null
  // 행사의 업무 탭이면 그 행사
  eventId: string | undefined
}

export type Placement = { departmentId: string | null; assigneeId: string | null }

// 보는 곳에서 바라는 부서: 부서 거르기, 회장단이면 학생회 업무, 그 밖은 내 부서 가운데 부장인 부서 먼저 첫 것.
function wantedDepartment({ view, dept }: QuickAddContext): string | null {
  if (dept !== null) return dept
  if (view.me.councilRank !== null) return null
  const mine = view.me.departments
  return (mine.find(item => item.rank !== null) ?? mine[0])?.id ?? null
}

// 새 업무의 부서와 담당자. 바라는 값이 서버 선택지에 없으면 선택지의 첫 부서,
// 담당자는 그 부서 선택지에 '나'가 있으면 나, 없으면 첫 값이다. 화면은 선택지 안에서 고르기만 한다(DEC-38).
export function defaultPlacement(
  options: TaskCreateOptionsResponse,
  context: QuickAddContext,
): Placement | null {
  const wanted = wantedDepartment(context)
  const department = options.departments.find(item => item.id === wanted) ?? options.departments[0]
  if (!department) return null
  const me = context.view.me.memberId
  const wantedAssignee = context.taskView === 'mine' ? me : null
  const has = (id: string | null) => department.assignees.some(item => item.id === id)
  const assigneeId = has(wantedAssignee)
    ? wantedAssignee
    : has(me)
      ? me
      : (department.assignees[0]?.id ?? null)
  return { departmentId: department.id, assigneeId }
}

// 보기 탭이 받아들이는 업무인가.
function inTab(
  task: Pick<TaskDetail, 'department' | 'assignee'>,
  view: CouncilView,
  tab: TaskView,
) {
  if (tab === 'mine') return task.assignee?.id === view.me.memberId
  if (tab === 'unassigned') return task.assignee === null
  if (tab === 'department') return view.me.departments.some(item => item.id === task.department?.id)
  return true
}

// 만든 업무가 지금 보기에 보이는가(행사, 부서 거르기, 보기 탭). 아니면 빠른 추가가 그렇다고 알린다.
export function visibleInView(
  task: Pick<TaskDetail, 'department' | 'assignee' | 'event'>,
  { view, taskView, dept, eventId }: QuickAddContext,
): boolean {
  if (eventId !== undefined && task.event?.id !== eventId) return false
  if (dept !== null && task.department?.id !== dept) return false
  return inTab(task, view, taskView)
}
