import { daysBetween, HOME_SOON_DAYS, koreanDateOf, type TaskSummary } from '@vada/contracts'
import { isUnassignedTask } from '@/tasks/task-unassigned'
import { json } from './mock-api'

// 서버의 업무 목록 보기·거르기(api tasks/queries.ts viewCondition·narrowCondition)를 받은 목록에 흉내 낸다. 화면 시험의 가짜 서버용이다.
// 뜻의 원문은 api 시험(tasks/list-filters.test.ts)이다. me는 요청한 사람, heads는 그 사람이 직급을 가진 부서다.
type Me = { memberId: string; heads?: string[]; today?: string }

const open = (task: TaskSummary) => task.status !== 'done'

function inWeek(task: TaskSummary, today: string) {
  if (!task.dueDate || !open(task)) return false
  const days = daysBetween(today, task.dueDate)
  return days >= 0 && days <= HOME_SOON_DAYS
}

function matchesDue(task: TaskSummary, due: string | null, today: string) {
  if (due === 'overdue') return open(task) && task.overdue
  if (due === 'none') return open(task) && task.dueDate === null
  if (due === 'week') return inWeek(task, today)
  return true
}

function matchesValue(value: string | null, id: string | undefined, none: boolean) {
  if (value === null) return true
  return value === 'none' ? none : id === value
}

function matchesView(task: TaskSummary, view: string | null, me: Required<Me>) {
  if (view === 'mine') return task.assignee?.id === me.memberId
  return view !== 'unassigned' || isUnassignedTask(task)
}

const needsAttention = (task: TaskSummary) => open(task) && (task.overdue || isUnassignedTask(task))

function matchesScope(task: TaskSummary, query: URLSearchParams, me: Required<Me>) {
  return (
    matchesView(task, query.get('view'), me) &&
    matchesValue(query.get('dept'), task.department?.id, task.department === null) &&
    matchesValue(query.get('assignee'), task.assignee?.id, isUnassignedTask(task))
  )
}

function matches(task: TaskSummary, query: URLSearchParams, me: Required<Me>) {
  return (
    matchesScope(task, query, me) &&
    matchesDue(task, query.get('due'), me.today) &&
    (!query.get('attention') || needsAttention(task)) &&
    (!query.get('heads') || me.heads.includes(task.department?.id ?? ''))
  )
}

function narrowTasks(tasks: TaskSummary[], path: string, me: Me) {
  const query = new URL(path, 'http://localhost').searchParams
  const full = { heads: [], today: koreanDateOf(new Date()), ...me }
  return tasks.filter(task => matches(task, query, full))
}

// 업무 목록 요청에 보기(내 업무·담당자 없음)와 거르기 키를 서버처럼 적용해 답한다. tasks는 요청 주소마다 거르기 전 목록을 준다.
export const narrowedTasksResponse =
  (tasks: (path: string) => TaskSummary[], me: Me, truncated = false) =>
  ({ path }: { path: string }) =>
    json({ tasks: narrowTasks(tasks(path), path, me), truncated })
