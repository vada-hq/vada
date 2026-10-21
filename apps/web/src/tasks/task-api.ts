import type { TaskFilter, TaskView } from '@vada/contracts'

const tasksBase = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}/tasks`
export const tasksPath = (councilId: string, view: TaskView, status: TaskFilter) =>
  `${tasksBase(councilId)}?view=${view}&status=${status}`
export const taskStatusPath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/status`
