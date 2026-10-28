import { and, eq } from 'drizzle-orm'
import type {
  AssignTaskRequest,
  ChangeTaskStatusRequest,
  CreateTaskRequest,
  SetTaskDepartmentRequest,
  TaskAction,
  TaskStatus,
  TaskDetail,
  UpdateTaskRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { lockCurrentMembers } from '../chat/current-members.js'
import { department, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { assertFollowUpOrigin } from '../meetings/follow-up.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { dueAtOf, dueDateOf } from './due.js'
import { assertDepartmentLink, eventChangeOf, eventLinkOf } from './event-link.js'
import { humanMoveOf } from './lifecycle.js'
import { decide, decideCreate, factsOf } from './policy.js'
import { taskDetailOf, taskRowOf } from './queries.js'

// 고칠 업무와 요청 시각. 조각 4의 맡기기도 같은 모양으로 부른다.
export type Target = { taskId: string; now: Date }

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 업무 행 읽기 → 권한표 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 업무를 읽은 뒤 권한을 묻는 까닭: 부장·담당자 기준은 업무의 부서와 담당자를 맥락으로 묻기 때문이다.
// 다른 학생회·지운 업무는 없는 것과 같아 404이고, 읽은 뒤 권한이 없으면 403이다.
async function taskFor(tx: Tx, actor: Actor, target: Target, action: TaskAction) {
  const row = await taskRowOf(tx, actor, target.taskId, target.now)
  const code = decide(actor, factsOf(row), action)
  if (code) throw new ApiError(code)
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

// 맡긴 뒤 새 담당자에게 보낼 알림. 커밋 뒤에 보내고, 기록은 같은 거래에서 이미 남겼다.
export type AssignmentNotice = {
  taskId: string
  // 비우면 null
  recipientId: string | null
  assignerId: string
  // 바꾸기 전 담당자. 알림을 모을 때 처음 담당자를 알아내는 데 쓴다.
  previous: string | null
}

// 담당자가 바뀔 때마다 알림 모으기 창을 연다. 비우기와 나에게 맡기기도 포함해야 10초 안에 처음 담당자로
// 되돌릴 때 알림이 막힌다. 기록은 새 담당자가 남일 때만 남긴다(T3). 같은 사람 다시는 없다.
async function noticeAssignment(
  tx: Tx,
  actor: Actor,
  taskId: string,
  { previous, next }: { previous: string | null; next: string | null },
): Promise<AssignmentNotice | null> {
  if (next === previous) return null
  if (next && next !== actor.memberId)
    await createRecord(tx, {
      kind: 'notification',
      councilId: actor.councilId,
      actor: null,
      values: { recipientId: next, recordId: taskId, type: 'assignment', notifiedAt: clockNow },
    })
  return { taskId, recipientId: next, assignerId: actor.memberId, previous }
}

export async function createTask(
  tx: Tx,
  actor: Actor,
  input: CreateTaskRequest,
  now: Date,
): Promise<{ task: TaskDetail; notice: AssignmentNotice | null }> {
  const origin = input.agendaItemId
    ? {
        originId: await assertFollowUpOrigin(tx, actor, input.agendaItemId),
        originKind: 'agenda_item' as const,
      }
    : {}
  // 403이 409보다 먼저다. 행사 책임자는 그 행사의 업무를 어느 부서로든 만든다(새 부서 잇기 포함, decideEventLink).
  const link = await eventLinkOf(tx, actor, input.eventId)
  const denied = decideCreate(actor, input, link)
  if (denied) throw new ApiError(denied)
  if (!link.valid) throw new ApiError('EVENT_INVALID')
  await assertDepartment(tx, actor, input.departmentId)
  await assertAssignee(tx, actor, input.assigneeId, now)
  const id = await createRecord(tx, {
    kind: 'task',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      ...origin,
      title: input.title,
      body: input.body,
      dueAt: dueAtOf(input.dueDate),
      departmentId: input.departmentId,
      assigneeId: input.assigneeId,
      eventId: input.eventId,
    },
  })
  const notice = await noticeAssignment(tx, actor, id, { previous: null, next: input.assigneeId })
  return { task: await taskDetailOf(tx, actor, id, now), notice }
}

// 같은 값이면 판을 만들지 않는다. 마감은 날짜로 견준다. 행사를 바꾸면 앞과 뒤 맥락 모두에서 권한을 본다(event-link.ts).
export async function updateTask(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: UpdateTaskRequest,
): Promise<TaskDetail> {
  const row = await taskFor(tx, actor, target, 'task.edit')
  const changes = {
    ...(input.title !== undefined && input.title !== row.title ? { title: input.title } : {}),
    ...(input.body !== undefined && input.body !== row.body ? { body: input.body } : {}),
    ...(input.dueDate !== undefined && input.dueDate !== dueDateOf(row.dueAt)
      ? { dueAt: dueAtOf(input.dueDate) }
      : {}),
    ...(await eventChangeOf(tx, actor, row, input.eventId)),
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
  const row = await taskFor(tx, actor, target, 'task.change_status')
  const status = humanMoveOf(row.status as TaskStatus, input.status)
  if (status)
    await updateRecord(tx, {
      kind: 'task',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes: { status },
    })
  return taskDetailOf(tx, actor, row.id, target.now)
}

// 지우기는 취소한 시각을 채우는 것이다(DEC-49). 판과 알림 기록은 남는다.
export async function deleteTask(tx: Tx, actor: Actor, target: Target) {
  const row = await taskFor(tx, actor, target, 'task.remove')
  await updateRecord(tx, {
    kind: 'task',
    id: row.id,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}

// 사람 맡기기와 비우기. 부장 기준이라 담당자 본인은 403이다. 같은 사람이면 판도 알림도 없다.
export async function assignTask(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: AssignTaskRequest,
): Promise<{ task: TaskDetail; notice: AssignmentNotice | null }> {
  const row = await taskFor(tx, actor, target, 'task.change_assignee')
  await assertAssignee(tx, actor, input.assigneeId, target.now)
  if (input.assigneeId === row.assigneeId)
    return { task: await taskDetailOf(tx, actor, row.id, target.now), notice: null }
  await updateRecord(tx, {
    kind: 'task',
    id: row.id,
    actor: actor.memberId,
    reason: null,
    changes: { assigneeId: input.assigneeId },
  })
  const notice = await noticeAssignment(tx, actor, row.id, {
    previous: row.assigneeId,
    next: input.assigneeId,
  })
  return { task: await taskDetailOf(tx, actor, row.id, target.now), notice }
}

// 부서 정하기와 비우기. 회장단만 한다. 담당자는 그대로다. 이어진 행사에 새 부서를 잇는 것이면 잇기와 같은 판정이다(403이 409보다 먼저).
export async function setTaskDepartment(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: SetTaskDepartmentRequest,
): Promise<TaskDetail> {
  const row = await taskFor(tx, actor, target, 'task.change_department')
  await assertDepartmentLink(tx, actor, row, input.departmentId)
  await assertDepartment(tx, actor, input.departmentId)
  if (input.departmentId !== row.departmentId)
    await updateRecord(tx, {
      kind: 'task',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes: { departmentId: input.departmentId },
    })
  return taskDetailOf(tx, actor, row.id, target.now)
}
