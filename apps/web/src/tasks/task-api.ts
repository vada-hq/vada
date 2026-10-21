import type { TaskFilter, TaskView } from '@vada/contracts'

// 목록은 화면이 보이는 동안 15초마다 다시 읽는다(대화 방 목록과 같다). 알림이 오면 바로 한 번 더 읽는다.
export const TASK_POLL_MS = 15_000

const tasksBase = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}/tasks`
export const tasksPath = (councilId: string, view: TaskView, status: TaskFilter) =>
  `${tasksBase(councilId)}?view=${view}&status=${status}`
export const taskStatusPath = (councilId: string, taskId: string) =>
  `${tasksBase(councilId)}/${encodeURIComponent(taskId)}/status`
