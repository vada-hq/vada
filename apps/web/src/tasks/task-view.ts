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

// 카드의 상태 바꾸기 버튼. 할 일은 시작, 진행 중은 끝내기다. 끝난 업무를 되돌리는 것은 상세에서 한다.
export const NEXT_STEP: Record<TaskStatus, { label: string; to: TaskStatus } | null> = {
  todo: { label: '시작', to: 'in_progress' },
  in_progress: { label: '끝내기', to: 'done' },
  done: null,
}

export interface TaskCount {
  label: string
  tone: 'danger' | 'info'
  description: string
}

// 옆 메뉴 '업무'의 수: 내 업무 중 지난 것이 있으면 그 수(danger), 없으면 남은 수(info). 0이면 없고, 넘치면 '+'다.
export function countOf(mine: TaskSummary[], truncated: boolean): TaskCount | null {
  const overdue = mine.filter(task => task.overdue).length
  const plus = truncated ? '+' : ''
  const more = truncated ? ' 이상' : ''
  if (overdue > 0)
    return {
      label: `지남 ${overdue}${plus}`,
      tone: 'danger',
      description: `지난 업무 ${overdue}개${more}`,
    }
  if (mine.length === 0) return null
  return {
    label: `${mine.length}${plus}`,
    tone: 'info',
    description: `남은 업무 ${mine.length}개${more}`,
  }
}
