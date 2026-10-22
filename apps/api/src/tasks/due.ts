import { DAY_MS, koreanDateOf, type TaskStatus } from '@vada/contracts'

export const dueDateOf = (dueAt: Date | null) => (dueAt ? koreanDateOf(dueAt) : null)

// 지남은 끝나지 않았고 오늘(한국)이 마감일 뒤일 때다. 서버가 세므로 화면의 시계에 기대지 않는다.
export function isOverdue(dueAt: Date | null, status: TaskStatus, now: Date) {
  return status !== 'done' && dueAt !== null && koreanDateOf(now) > koreanDateOf(dueAt)
}

export type DueGroup = 'overdue' | 'today' | 'soon' | 'later' | 'none'

// 끝나지 않은 업무가 마감으로 어느 묶음인가(홈). 끝난 업무는 받지 않는다(부르는 쪽이 거른다). 지남은 isOverdue와 같은 판단이라 업무 화면의 overdue와 어긋나지 않는다.
// 한국에는 서머타임이 없어 날수를 시각에 더해도 날짜가 밀리지 않는다.
export function dueGroupOf(dueAt: Date | null, now: Date, soonDays: number): DueGroup {
  if (dueAt === null) return 'none'
  if (isOverdue(dueAt, 'todo', now)) return 'overdue'
  const due = koreanDateOf(dueAt)
  if (due === koreanDateOf(now)) return 'today'
  return due <= koreanDateOf(new Date(now.getTime() + soonDays * DAY_MS)) ? 'soon' : 'later'
}

// 마감 날짜는 그날 한국 23:59:59로 저장한다(T2). 날짜는 계약이 이미 달력에 있는 날로 거른 것이다.
export const dueAtOf = (dueDate: string | null) =>
  dueDate ? new Date(`${dueDate}T23:59:59+09:00`) : null
