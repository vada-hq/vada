import { koreanDateOf, type TaskStatus } from '@vada/contracts'

export const dueDateOf = (dueAt: Date | null) => (dueAt ? koreanDateOf(dueAt) : null)

// 지남은 끝나지 않았고 오늘(한국)이 마감일 뒤일 때다. 서버가 세므로 화면의 시계에 기대지 않는다.
export function isOverdue(dueAt: Date | null, status: TaskStatus, now: Date) {
  return status !== 'done' && dueAt !== null && koreanDateOf(now) > koreanDateOf(dueAt)
}

// 마감 날짜는 그날 한국 23:59:59로 저장한다(T2). 날짜는 계약이 이미 달력에 있는 날로 거른 것이다.
export const dueAtOf = (dueDate: string | null) =>
  dueDate ? new Date(`${dueDate}T23:59:59+09:00`) : null
