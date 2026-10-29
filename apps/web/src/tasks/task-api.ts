import { TASK_NARROW_KEYS, type TaskFilter, type TaskView } from '@vada/contracts'

// 서버가 목록 상한 전에 거르는 칩·홈 범위(contracts TaskListQuerySchema). 값이 없으면 걸지 않는다.
export type TaskNarrow = Partial<Record<(typeof TASK_NARROW_KEYS)[number], string | null>>

export const tasksBase = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/tasks`
// 행사를 주면 그 행사의 업무만 읽는다. 칩·홈 범위(narrow)는 서버가 상한 전에 거른다. 값이 없는 키는 싣지 않는다.
export function tasksPath(
  councilId: string,
  { view, status, eventId }: { view: TaskView; status: TaskFilter; eventId?: string | undefined },
  narrow: TaskNarrow = {},
) {
  const keys = TASK_NARROW_KEYS.flatMap(key => {
    const value = narrow[key]
    return value ? [`&${key}=${encodeURIComponent(value)}`] : []
  })
  const event = eventId ? `&event=${encodeURIComponent(eventId)}` : ''
  return `${tasksBase(councilId)}?view=${view}&status=${status}${event}${keys.join('')}`
}
// 만들 때 고를 수 있는 부서와 담당자. 행사의 업무 탭이면 그 행사를 준다.
export const taskOptionsPath = (councilId: string, eventId?: string) =>
  `${tasksBase(councilId)}/options${eventId ? `?event=${encodeURIComponent(eventId)}` : ''}`
export const taskStatusPath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/status`
export const taskAssigneePath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/assignee`
