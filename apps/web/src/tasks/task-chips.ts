import type { TaskSummary } from '@vada/contracts'
import { isUnassignedTask } from './task-unassigned'

export type TaskChipCounts = { overdue: number; mine: number; unassigned: number; noDue: number }
export type TaskChip = 'overdue' | 'unassigned' | 'none'

// 수의 원문은 그 탭·행사 범위의 열린 목록이다. 누른 칩과 부서·사람·토글은 이 목록에 적용하지 않는다(서버가 거른 보이는 목록과 따로 읽는다).
export function chipCounts(tasks: TaskSummary[], memberId: string): TaskChipCounts {
  const open = tasks.filter(task => task.status !== 'done')
  return {
    overdue: open.filter(task => task.overdue).length,
    mine: open.filter(task => task.assignee?.id === memberId).length,
    unassigned: open.filter(isUnassignedTask).length,
    noDue: open.filter(task => task.dueDate === null).length,
  }
}

// 담당자 없음과 마감 칩은 둘 중 하나만 남긴다. UUID 담당자는 마감 칩과 겹쳐 걸 수 있다.
export function chipChange(scope: { due: string | null; assignee: string | null }, chip: TaskChip) {
  if (chip === 'unassigned')
    return { due: null, assignee: scope.assignee === 'none' ? null : 'none' }
  return {
    due: scope.due === chip ? null : chip,
    ...(scope.assignee === 'none' ? { assignee: null } : {}),
  }
}
