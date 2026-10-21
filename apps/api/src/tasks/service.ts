import { and, eq } from 'drizzle-orm'
import type {
  ChangeTaskStatusRequest,
  CreateTaskRequest,
  TaskAction,
  TaskDetail,
  UpdateTaskRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { lockCurrentMembers } from '../chat/current-members.js'
import { department, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { taskContext } from './actions.js'
import { dueAtOf, dueDateOf } from './due.js'
import { taskDetailOf, taskRowOf } from './queries.js'

// 고칠 업무와 요청 시각. 조각 4의 맡기기도 같은 모양으로 부른다.
export type Target = { taskId: string; now: Date }

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 업무 행 읽기 → 권한표 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 업무를 읽은 뒤 권한을 묻는 까닭: 부장·담당자 기준은 업무의 부서와 담당자를 맥락으로 묻기 때문이다.
// 다른 학생회·지운 업무는 없는 것과 같아 404이고, 읽은 뒤 권한이 없으면 403이다.
async function taskFor(tx: Tx, actor: Actor, target: Target, action: TaskAction) {
  const row = await taskRowOf(tx, actor, target.taskId, target.now)
  if (!can(actor, action, taskContext(row))) throw new ApiError('FORBIDDEN')
  return row
}

// 부서는 이 학생회의 것이어야 한다. 외래 키는 학생회까지 맞추지 못한다.
async function assertDepartment(tx: Tx, actor: Actor, departmentId: string | null) {
  if (!departmentId) return
  const [found] = await tx
    .select({ id: department.id })
    .from(department)
    .innerJoin(record, eq(record.id, department.id))
    .where(and(eq(department.id, departmentId), eq(record.councilId, actor.councilId)))
  if (!found) throw new ApiError('TASK_DEPARTMENT_INVALID')
}

// 담당자는 지금 이 학생회의 운영진이어야 한다. 소속 줄을 잠가 확인과 쓰기 사이에 내보내지지 않게 한다.
async function assertAssignee(tx: Tx, actor: Actor, assigneeId: string | null, now: Date) {
  if (!assigneeId) return
  const alive = await lockCurrentMembers(tx, actor.councilId, [assigneeId], now)
  if (!alive.has(assigneeId)) throw new ApiError('TASK_ASSIGNEE_INVALID')
}

// 만들기의 '본인': 담당자가 나여도 부서가 없거나 내 부서일 때만 담당자 기준을 준다(남의 부서 목록에 넣지 않는다).
function createContext(actor: Actor, input: CreateTaskRequest) {
  const mine =
    input.assigneeId === actor.memberId &&
    (!input.departmentId ||
      actor.departments.some(item => item.departmentId === input.departmentId))
  return taskContext({
    departmentId: input.departmentId,
    assigneeId: mine ? input.assigneeId : null,
  })
}

export async function createTask(
  tx: Tx,
  actor: Actor,
  input: CreateTaskRequest,
  now: Date,
): Promise<TaskDetail> {
  // 403이 409보다 먼저다.
  if (!can(actor, 'task.manage', createContext(actor, input))) throw new ApiError('FORBIDDEN')
  await assertDepartment(tx, actor, input.departmentId)
  await assertAssignee(tx, actor, input.assigneeId, now)
  const id = await createRecord(tx, {
    kind: 'task',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      title: input.title,
      body: input.body,
      dueAt: dueAtOf(input.dueDate),
      departmentId: input.departmentId,
      assigneeId: input.assigneeId,
    },
  })
  return taskDetailOf(tx, actor, id, now)
}

// 같은 값이면 판을 만들지 않는다. 마감은 날짜로 견준다.
export async function updateTask(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: UpdateTaskRequest,
): Promise<TaskDetail> {
  const row = await taskFor(tx, actor, target, 'task.manage')
  const changes = {
    ...(input.title !== row.title ? { title: input.title } : {}),
    ...(input.body !== row.body ? { body: input.body } : {}),
    ...(input.dueDate !== dueDateOf(row.dueAt) ? { dueAt: dueAtOf(input.dueDate) } : {}),
  }
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'task',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes,
    })
  return taskDetailOf(tx, actor, row.id, target.now)
}

export async function changeTaskStatus(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: ChangeTaskStatusRequest,
): Promise<TaskDetail> {
  const row = await taskFor(tx, actor, target, 'task.status')
  if (input.status !== row.status)
    await updateRecord(tx, {
      kind: 'task',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes: { status: input.status },
    })
  return taskDetailOf(tx, actor, row.id, target.now)
}

// 지우기는 취소한 시각을 채우는 것이다(DEC-49). 판과 알림 기록은 남는다.
export async function deleteTask(tx: Tx, actor: Actor, target: Target) {
  const row = await taskFor(tx, actor, target, 'task.manage')
  await updateRecord(tx, {
    kind: 'task',
    id: row.id,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
