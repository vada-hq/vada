import type { TaskSummary } from '@vada/contracts'
import { COUNCIL_TASK_LABEL } from './task-view'

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

// 마감이 이른 순, 마감 없는 업무는 뒤.
export const byDue = (a: TaskSummary, b: TaskSummary) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')

export type TaskSection = { key: string; title: string; tasks: TaskSummary[] }

export function groupByDue(tasks: TaskSummary[], today: string): TaskSection[] {
  return DUE_ORDER.map(key => ({
    key,
    title: DUE_GROUP_LABEL[key],
    tasks: tasks.filter(task => dueGroupOf(task, today) === key).sort(byDue),
  })).filter(section => section.tasks.length > 0)
}

// 부서마다 진행 상황(요구 14, 20): 진행 중, 지남, 담당자 없음 수.
export function sectionSummary(tasks: TaskSummary[]) {
  return {
    inProgress: tasks.filter(task => task.status === 'in_progress').length,
    overdue: tasks.filter(task => task.overdue).length,
    unassigned: tasks.filter(task => task.assignee === null && task.status !== 'done').length,
  }
}

// 부서 이름순으로 묶고 부서 없는 업무('학생회 업무')는 맨 뒤에 둔다. 묶음 안은 마감 순이다.
export function groupByDepartment(tasks: TaskSummary[]): TaskSection[] {
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
  return [...groups.values()]
    .map(group => ({ ...group, tasks: [...group.tasks].sort(byDue) }))
    .sort((a, b) => {
      if (a.key === '') return 1
      if (b.key === '') return -1
      return a.title.localeCompare(b.title, 'ko')
    })
}
