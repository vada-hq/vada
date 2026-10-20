import { koreanDateOf, type TaskStatus } from '@vada/contracts'

export const dueDateOf = (dueAt: Date | null) => (dueAt ? koreanDateOf(dueAt) : null)

// 지남은 끝나지 않았고 오늘(한국)이 마감일 뒤일 때다. 서버가 세므로 화면의 시계에 기대지 않는다.
export function isOverdue(dueAt: Date | null, status: TaskStatus, now: Date) {
  return status !== 'done' && dueAt !== null && koreanDateOf(now) > koreanDateOf(dueAt)
}
