import type { TaskSummary } from '@vada/contracts'
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
