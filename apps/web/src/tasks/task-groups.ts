import type { TaskSummary } from '@vada/contracts'
import { COUNCIL_TASK_LABEL } from './task-view'
import { isUnassignedTask } from './task-unassigned'

// 내 업무를 급한 순으로 나누는 묶음(screens.md 내 업무: 지남, 오늘, 7일 안, 그 뒤).
type DueGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none'
const DUE_GROUP_LABEL: Record<DueGroupKey, string> = {
  overdue: '지남',
  today: '오늘',
  week: '7일 안',
  later: '나중',
  none: '마감 없음',
}
const DUE_ORDER: DueGroupKey[] = ['overdue', 'today', 'week', 'later', 'none']
const WEEK_DAYS = 7
const DAY_MS = 86_400_000

// 'YYYY-MM-DD' 두 날짜 사이의 날 수(달력으로 센다).
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

export function dueGroupOf(task: Pick<TaskSummary, 'dueDate' | 'overdue'>, today: string) {
  if (task.overdue) return 'overdue'
  if (task.dueDate === null) return 'none'
  const days = daysBetween(today, task.dueDate)
  if (days <= 0) return 'today'
  return days <= WEEK_DAYS ? 'week' : 'later'
}

export type TaskSection = { key: string; title: string; tasks: TaskSummary[] }

// 묶음 안은 받은 차례(고른 정렬, task-sort.ts) 그대로다.
export function groupByDue(tasks: TaskSummary[], today: string): TaskSection[] {
  return DUE_ORDER.map(key => ({
    key,
    title: DUE_GROUP_LABEL[key],
    tasks: tasks.filter(task => dueGroupOf(task, today) === key),
  })).filter(section => section.tasks.length > 0)
}

// 부서마다 진행 상황(요구 14, 20): 진행 중, 지남, 담당자 없음 수.
export function sectionSummary(tasks: TaskSummary[]) {
  return {
    inProgress: tasks.filter(task => task.status === 'in_progress').length,
    overdue: tasks.filter(task => task.overdue).length,
    unassigned: tasks.filter(isUnassignedTask).length,
  }
}

// 조직의 부서 차례(order)로 묶고 부서 없는 업무('학생회 업무')는 맨 뒤에 둔다. 조직에 없는 부서는 아는 부서 뒤에 이름순이다.
// 묶음 안은 받은 차례(고른 정렬, task-sort.ts) 그대로다.
export function groupByDepartment(
  tasks: TaskSummary[],
  order: readonly { id: string }[] = [],
): TaskSection[] {
  const groups = new Map<string, TaskSection>()
  for (const task of tasks) {
    const key = task.department?.id ?? ''
    const group = groups.get(key) ?? {
      key,
      title: task.department?.name ?? COUNCIL_TASK_LABEL,
      tasks: [],
    }
    group.tasks.push(task)
    groups.set(key, group)
  }
  const rank = (key: string) => {
    if (key === '') return order.length + 1
    const index = order.findIndex(dept => dept.id === key)
    return index === -1 ? order.length : index
  }
  return [...groups.values()].sort(
    (a, b) => rank(a.key) - rank(b.key) || a.title.localeCompare(b.title, 'ko'),
  )
}
