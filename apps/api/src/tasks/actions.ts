import { TASK_ACTIONS, type TaskAction } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, type Context } from '../access/permissions.js'

type TaskOwners = {
  departmentId: string | null
  assigneeId: string | null
  // 이어진 행사의 책임자. 행사가 없거나 책임자가 없으면 null이다.
  eventOwnerId: string | null
}

// 업무 칸이 묻는 맥락: 업무의 부서와 담당자, 이어진 행사의 책임자. 쓰기 경로도 같은 맥락으로 권한을 물어, 보이는 동작과 되는 동작이 갈리지 않는다.
export const taskContext = (task: TaskOwners): Context => ({
  ...(task.departmentId ? { departmentId: task.departmentId } : {}),
  ...(task.assigneeId ? { assigneeId: task.assigneeId } : {}),
  ...(task.eventOwnerId ? { eventOwnerId: task.eventOwnerId } : {}),
})

// 그 사람이 이 업무에서 할 수 있는 동작
export const actionsOf = (actor: Actor, task: TaskOwners): TaskAction[] =>
  TASK_ACTIONS.filter(action => can(actor, action, taskContext(task)))
