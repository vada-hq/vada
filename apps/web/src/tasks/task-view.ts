import type { TaskPerson, TaskStatus, TaskSummary } from '@vada/contracts'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '끝남',
}

// 부서가 없는 업무의 묶음 이름. 묶음 맨 뒤에 둔다.
const NO_DEPARTMENT = '학생회 업무'

// "2026-10-25" → "10월 25일". 마감이 없으면 "마감 없음".
export function dueLabel(dueDate: string | null) {
  if (!dueDate) return '마감 없음'
  const [, month, day] = dueDate.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

export function assigneeLabel(assignee: TaskPerson | null) {
  if (!assignee) return '담당자 없음'
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
  if (overdue > 0)
    return {
      label: `지남 ${overdue}${plus}`,
      tone: 'danger',
      description: `지난 업무 ${overdue}개`,
    }
  if (mine.length === 0) return null
  return { label: `${mine.length}${plus}`, tone: 'info', description: `남은 업무 ${mine.length}개` }
}

export interface TaskGroup {
  key: string
  name: string
  tasks: TaskSummary[]
}

// 부서 이름순으로 묶고 부서 없는 업무('학생회 업무')는 맨 뒤에 둔다. 묶음 안의 순서는 서버가 준 대로다.
export function groupByDepartment(tasks: TaskSummary[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>()
  for (const task of tasks) {
    const key = task.department?.id ?? ''
    const group = groups.get(key) ?? {
      key,
      name: task.department?.name ?? NO_DEPARTMENT,
      tasks: [],
    }
    group.tasks.push(task)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === b.key) return 0
    if (a.key === '') return 1
    if (b.key === '') return -1
    return a.name.localeCompare(b.name, 'ko')
  })
}
