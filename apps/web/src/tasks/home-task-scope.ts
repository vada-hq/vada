import { daysBetween, HOME_SOON_DAYS, type CouncilView, type TaskSummary } from '@vada/contracts'
import { isUnassignedTask } from './task-unassigned'
import { NO_ASSIGNEE_LABEL } from './task-view'

export type HomeTaskScope = {
  heads: boolean
  attention: boolean
  week: boolean
  assignee: string | null
}

export const homeScopeActive = (scope: HomeTaskScope) =>
  scope.heads || scope.assignee !== null || scope.attention || scope.week

export function homeScopeLabel(scope: HomeTaskScope, tasks: TaskSummary[]) {
  const who = tasks.find(task => task.assignee?.id === scope.assignee)?.assignee?.name
  return [
    scope.heads ? '직급 부서' : null,
    scope.assignee === 'none' ? NO_ASSIGNEE_LABEL : (who ?? (scope.assignee ? '담당자' : null)),
    scope.attention ? '지남·담당자 없음' : null,
    scope.week ? '7일 안 마감' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function withinWeek(task: TaskSummary, today: string) {
  if (!task.dueDate || task.status === 'done') return false
  const days = daysBetween(today, task.dueDate)
  return days >= 0 && days <= HOME_SOON_DAYS
}

const needsAttention = (task: TaskSummary) =>
  task.status !== 'done' && (task.overdue || isUnassignedTask(task))

function matchesAssignee(task: TaskSummary, assignee: string | null) {
  if (assignee === 'none') return task.status !== 'done' && isUnassignedTask(task)
  return assignee === null || task.assignee?.id === assignee
}

// 홈에서 연 범위는 목록과 보드·달력 모두에 같은 조건을 건다. 직급 부서는 현재 학생회 응답을 쓴다.
export function inHomeTaskScope(
  task: TaskSummary,
  scope: HomeTaskScope,
  council: CouncilView,
  today: string,
) {
  const heads = council.me.departments.filter(dept => dept.rank !== null).map(dept => dept.id)
  if (scope.heads && (!task.department || !heads.includes(task.department.id))) return false
  if (!matchesAssignee(task, scope.assignee)) return false
  if (scope.attention && !needsAttention(task)) return false
  return !scope.week || withinWeek(task, today)
}
