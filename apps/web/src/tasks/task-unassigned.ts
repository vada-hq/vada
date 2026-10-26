import type { TaskSummary } from '@vada/contracts'

// 받은 목록은 취소한 업무가 빠져 있다. 부서 유무는 담당자 없음의 조건이 아니다(DEC-94).
export const isUnassignedTask = (task: Pick<TaskSummary, 'status' | 'assignee'>) =>
  task.status !== 'done' && (task.assignee === null || !task.assignee.current)
