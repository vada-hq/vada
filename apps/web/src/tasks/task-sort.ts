import type { TaskSummary } from '@vada/contracts'

// 업무 화면의 정렬. 보드의 열, 표·줄의 묶음, 내 업무의 마감 묶음은 그대로 두고 그 안의 차례만 정한다(Linear의 Grouping·Ordering처럼 묶음과 차례는 따로다).
// 서버가 상한 안에 들일 업무를 고른 뒤(끝나지 않은 것은 급한 순 300개, 끝남은 최근 50개) 화면이 받은 목록 안에서만 줄 세운다.
// 서버에서 부서별로 자르면 상한을 넘을 때 뒤 부서가 통째로 빠지기 때문이다.
export const TASK_SORTS = ['department', 'due', 'recent'] as const
export type TaskSort = (typeof TASK_SORTS)[number]
export const TASK_SORT_LABEL: Record<TaskSort, string> = {
  department: '부서별',
  due: '마감 임박순',
  recent: '최신순',
}

type Compare = (a: TaskSummary, b: TaskSummary) => number

const byCreated: Compare = (a, b) =>
  (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id)

// 마감이 이른 것부터, 마감 없음은 뒤. 같으면 먼저 만든 것부터.
const byDue: Compare = (a, b) => {
  if (a.dueDate === b.dueDate) return byCreated(a, b)
  if (a.dueDate === null) return 1
  if (b.dueDate === null) return -1
  return a.dueDate.localeCompare(b.dueDate)
}

// 부서 차례는 조직(운영진 > 부서)의 부서 목록 차례다. 목록에 없는 부서는 그 뒤, 부서 없는 업무(학생회 업무)는 맨 뒤다.
function byDepartment(order: readonly { id: string }[]): Compare {
  const rank = (task: TaskSummary) => {
    if (task.department === null) return order.length + 1
    const index = order.findIndex(dept => dept.id === task.department?.id)
    return index === -1 ? order.length : index
  }
  return (a, b) => rank(a) - rank(b) || byDue(a, b)
}

export function sortTasks(
  tasks: readonly TaskSummary[],
  sort: TaskSort,
  order: readonly { id: string }[],
): TaskSummary[] {
  const compare: Compare =
    sort === 'department' ? byDepartment(order) : sort === 'due' ? byDue : (a, b) => byCreated(b, a)
  return [...tasks].sort(compare)
}
