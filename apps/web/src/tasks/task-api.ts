import type { TaskFilter, TaskView } from '@vada/contracts'

export const tasksBase = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/tasks`
// 행사를 주면 그 행사의 업무만 읽는다.
export const tasksPath = (
  councilId: string,
  view: TaskView,
  status: TaskFilter,
  eventId?: string,
) =>
  `${tasksBase(councilId)}?view=${view}&status=${status}${eventId ? `&event=${encodeURIComponent(eventId)}` : ''}`
export const taskStatusPath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/status`
export const taskAssigneePath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/assignee`
