import { monthDay } from '@/lib/korean-date-text'
import type { TaskPerson, TaskStatus, TaskSummary } from '@vada/contracts'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '끝남',
}

// 부서가 없는 업무의 이름(묶음 이름, 고르는 칸, 이력). 묶음에서는 맨 뒤에 둔다.
export const COUNCIL_TASK_LABEL = '학생회 업무'
export const NO_ASSIGNEE_LABEL = '담당자 없음'
export const NO_EVENT_LABEL = '행사 없음'

// 마감이 없으면 "마감 없음".
export const dueLabel = (dueDate: string | null) => (dueDate ? monthDay(dueDate) : '마감 없음')

export function assigneeLabel(assignee: TaskPerson | null) {
  if (!assignee) return NO_ASSIGNEE_LABEL
  return assignee.current ? assignee.name : `떠난 사람: ${assignee.name}`
}

// 카드의 상태 바꾸기 버튼 이름. 어디로 가는지(next)는 서버가 정하고 화면은 이름만 붙인다.
export const nextLabel = (next: TaskStatus) => (next === 'done' ? '끝내기' : '시작')

export interface TaskCount {
  count: number
  // 목록이 잘려 실제 수가 더 클 수 있다.
  more: boolean
}

// 옆 메뉴 '업무'의 수 '지남 N': 내 업무 중 지난 것만 센다. 남은 수는 나에게 걸린 급한 일이 아니라 두지 않는다(DEC-96, DEC-94).
export function overdueOf(mine: TaskSummary[], truncated: boolean): TaskCount {
  return { count: mine.filter(task => task.overdue).length, more: truncated }
}
