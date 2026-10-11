import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { koreanOf, MY_TASKS_DONE_LIMIT, MY_TASKS_OPEN_LIMIT, TASKS_PER_EVENT_MAX, type ChangeTaskStatusRequest, type CreateTaskRequest,
  type DeleteTaskRequest, type EventTasksResponse, type MyTasksResponse, type TaskAction, type TaskDetail, type TaskSummary,
  type UpdateTaskRequest } from '@vada/contracts'
import { departments, events, memberships, registrationForms, taskEvents, tasks, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { lockActiveEvent, requireActiveEvents } from '../events/lock.js'

type Db = PgDatabase<PgQueryResultHKT>
export type TaskDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<TaskDatabase['transaction']>[0]>[0]
export interface TaskScope { organizationId: string; userId: string }

const assignees = alias(users, 'task_assignees')
const assigneeMemberships = alias(memberships, 'task_assignee_memberships')
const creators = alias(users, 'task_creators')
const actors = alias(users, 'task_actors')
// 보드와 내 업무 할 일의 순서: 마감일 순(없으면 뒤), 그다음 만든 순
const byDue = [sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt), asc(tasks.id)]

async function summaries(db: Reader, where: SQL | undefined, orderBy: SQL[], limit: number): Promise<TaskSummary[]> {
  const rows = await db.select({ task: tasks, eventName: events.name, departmentName: departments.name,
    assigneeMembershipId: assigneeMemberships.id, assigneeName: assignees.name, creatorName: creators.name }).from(tasks)
    .innerJoin(events, and(eq(events.organizationId, tasks.organizationId), eq(events.id, tasks.eventId)))
    .leftJoin(departments, and(eq(departments.organizationId, tasks.organizationId), eq(departments.id, tasks.departmentId)))
    .leftJoin(assigneeMemberships, and(eq(assigneeMemberships.organizationId, tasks.organizationId), eq(assigneeMemberships.userId, tasks.assigneeId)))
    .leftJoin(assignees, eq(assignees.id, tasks.assigneeId))
    .innerJoin(creators, eq(creators.id, tasks.createdBy))
    .where(where).orderBy(...orderBy).limit(limit)
  return rows.map(({ task, ...row }) => ({
    id: task.id, event: { id: task.eventId, name: row.eventName }, title: task.title, description: task.description, status: task.status,
    department: task.departmentId && row.departmentName !== null ? { id: task.departmentId, name: row.departmentName } : null,
    assignee: row.assigneeMembershipId !== null && row.assigneeName !== null ? { membershipId: row.assigneeMembershipId, name: row.assigneeName } : null,
    dueOn: task.dueOn, completedAt: task.completedAt?.toISOString() ?? null, createdBy: { id: task.createdBy, name: row.creatorName },
    createdAt: task.createdAt.toISOString(), version: task.version,
  }))
}
const inOrganization = (scope: TaskScope) => eq(tasks.organizationId, scope.organizationId)

async function detailOf(db: Reader, scope: TaskScope, eventId: string, taskId: string): Promise<TaskDetail> {
  const [summary] = await summaries(db, and(inOrganization(scope), eq(tasks.eventId, eventId), eq(tasks.id, taskId)), byDue, 1)
  if (!summary) throw new ApiError('NOT_FOUND', 404)
  const history = await db.select({ entry: taskEvents, actorName: actors.name }).from(taskEvents)
    .innerJoin(actors, eq(actors.id, taskEvents.actorId))
    .where(and(eq(taskEvents.organizationId, scope.organizationId), eq(taskEvents.taskId, taskId)))
    .orderBy(asc(taskEvents.createdAt), asc(taskEvents.id))
  return { ...summary, history: history.map(({ entry, actorName }) => ({ id: entry.id, action: entry.action, actor: { id: entry.actorId, name: actorName },
    changes: entry.changes, createdAt: entry.createdAt.toISOString() })) }
}
async function record(tx: Transaction, scope: TaskScope, taskId: string, action: TaskAction, changes: Record<string, unknown> = {}) {
  await tx.insert(taskEvents).values({ id: randomUUID(), organizationId: scope.organizationId, taskId, actorId: scope.userId, action, changes })
}
// 부서는 업무 행보다 먼저 FOR KEY SHARE로 잠근다. 부서 지우기(회장단 부서 → 지울 부서 → 업무)와 순서가 엇갈리지 않게 한다.
async function lockDepartment(tx: Transaction, scope: TaskScope, departmentId: string | null) {
  if (departmentId === null) return { found: true, name: null }
  const [department] = await tx.select({ name: departments.name }).from(departments)
    .where(and(eq(departments.organizationId, scope.organizationId), eq(departments.id, departmentId))).for('key share')
  return department ? { found: true, name: department.name } : { found: false, name: null }
}
// 담당자는 같은 학생회에서 부서가 있는 구성원이다. 소속 행을 FOR SHARE로 잠가 그사이 미배정으로 옮겨지지 않게 한다.
// 이미 맡은 사람(current)은 맡긴 뒤 미배정이 되었어도 그대로 둘 수 있다.
async function lockAssignee(tx: Transaction, scope: TaskScope, membershipId: string | null, current: string | null) {
  if (membershipId === null) return null
  const [member] = await tx.select({ userId: memberships.userId, departmentId: memberships.departmentId, name: users.name }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.id, membershipId))).for('share', { of: memberships })
  if (!member || (member.departmentId === null && member.userId !== current)) throw new ApiError('TASK_ASSIGNEE_INVALID', 409)
  return member
}
// 업무 행을 잠근다. 다른 학생회나 다른 행사의 업무는 없는 것으로 본다.
async function lockTask(tx: Transaction, scope: TaskScope, eventId: string, taskId: string) {
  const [row] = await tx.select().from(tasks).where(and(inOrganization(scope), eq(tasks.id, taskId))).for('update')
  if (!row || row.eventId !== eventId) throw new ApiError('NOT_FOUND', 404)
  return row
}
async function departmentName(db: Reader, departmentId: string | null) {
  if (departmentId === null) return null
  const [department] = await db.select({ name: departments.name }).from(departments).where(eq(departments.id, departmentId))
  return department?.name ?? null
}
async function userName(db: Reader, userId: string | null) {
  if (userId === null) return null
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  return user?.name ?? null
}

export function createTaskService(db: TaskDatabase) {
  async function list(scope: TaskScope, eventId: string): Promise<EventTasksResponse> {
    const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.organizationId, scope.organizationId), eq(events.id, eventId)))
    if (!event) throw new ApiError('NOT_FOUND', 404)
    const [form] = await db.select({ closesAt: registrationForms.closesAt }).from(registrationForms)
      .where(and(eq(registrationForms.organizationId, scope.organizationId), eq(registrationForms.eventId, eventId)))
    return { tasks: await summaries(db, and(inOrganization(scope), eq(tasks.eventId, eventId)), byDue, TASKS_PER_EVENT_MAX),
      registrationClosesAt: form ? koreanOf(form.closesAt) : null }
  }
  return {
    list,
    get: (scope: TaskScope, eventId: string, taskId: string) => detailOf(db, scope, eventId, taskId),
    // 이 학생회에서 내가 맡은 업무. 완료한 행사(M5a)의 업무는 기록이라 뺀다. 할 일은 마감일 순, 완료는 최근 순이다.
    async mine(scope: TaskScope): Promise<MyTasksResponse> {
      const mine = and(inOrganization(scope), eq(tasks.assigneeId, scope.userId), isNull(events.completedAt))
      const open = await summaries(db, and(mine, ne(tasks.status, 'done')), byDue, MY_TASKS_OPEN_LIMIT + 1)
      const done = await summaries(db, and(mine, eq(tasks.status, 'done')), [desc(tasks.completedAt), desc(tasks.id)], MY_TASKS_DONE_LIMIT)
      return { open: open.slice(0, MY_TASKS_OPEN_LIMIT), done, truncated: open.length > MY_TASKS_OPEN_LIMIT }
    },
    async create(scope: TaskScope, eventId: string, input: CreateTaskRequest): Promise<TaskDetail> {
      return db.transaction(async tx => {
        // 행사 행을 잠그고 센다. 같은 행사에 동시에 더해도 상한을 넘지 않는다. 완료한 행사(M5a)는 막는다.
        await lockActiveEvent(tx, scope.organizationId, eventId)
        const department = await lockDepartment(tx, scope, input.departmentId)
        if (!department.found) throw new ApiError('TASK_DEPARTMENT_INVALID', 409)
        const assignee = await lockAssignee(tx, scope, input.assigneeMembershipId, null)
        const [total] = await tx.select({ n: count() }).from(tasks).where(and(inOrganization(scope), eq(tasks.eventId, eventId)))
        if ((total?.n ?? 0) >= TASKS_PER_EVENT_MAX) throw new ApiError('TASKS_FULL', 409)
        const id = randomUUID()
        await tx.insert(tasks).values({ id, organizationId: scope.organizationId, eventId, title: input.title, description: input.description,
          departmentId: input.departmentId, assigneeId: assignee?.userId ?? null, dueOn: input.dueOn, createdBy: scope.userId })
        await record(tx, scope, id, 'created')
        return detailOf(tx, scope, eventId, id)
      })
    },
    // 모든 칸을 받는다. 바뀐 칸만 이전·이후로 남기고, 부서·담당자는 그때의 이름으로 남긴다.
    async update(scope: TaskScope, eventId: string, taskId: string, input: UpdateTaskRequest): Promise<TaskDetail> {
      return db.transaction(async tx => {
        await requireActiveEvents(tx, scope.organizationId, [eventId])
        const department = await lockDepartment(tx, scope, input.departmentId)
        const row = await lockTask(tx, scope, eventId, taskId)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (!department.found) throw new ApiError('TASK_DEPARTMENT_INVALID', 409)
        const assignee = await lockAssignee(tx, scope, input.assigneeMembershipId, row.assigneeId)
        const assigneeId = assignee?.userId ?? null
        const changes: Record<string, unknown> = {}
        if (row.title !== input.title) changes.title = { from: row.title, to: input.title }
        if (row.description !== input.description) changes.description = { from: row.description, to: input.description }
        if (row.departmentId !== input.departmentId) changes.department = { from: await departmentName(tx, row.departmentId), to: department.name }
        if (row.assigneeId !== assigneeId) changes.assignee = { from: await userName(tx, row.assigneeId), to: assignee?.name ?? null }
        if (row.dueOn !== input.dueOn) changes.dueOn = { from: row.dueOn, to: input.dueOn }
        if (!Object.keys(changes).length) return detailOf(tx, scope, eventId, taskId)
        await tx.update(tasks).set({ title: input.title, description: input.description, departmentId: input.departmentId, assigneeId,
          dueOn: input.dueOn, version: sql`${tasks.version} + 1` }).where(and(inOrganization(scope), eq(tasks.id, taskId)))
        await record(tx, scope, taskId, 'updated', changes)
        return detailOf(tx, scope, eventId, taskId)
      })
    },
    async changeStatus(scope: TaskScope, eventId: string, taskId: string, input: ChangeTaskStatusRequest): Promise<TaskDetail> {
      return db.transaction(async tx => {
        await requireActiveEvents(tx, scope.organizationId, [eventId])
        const row = await lockTask(tx, scope, eventId, taskId)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (row.status === input.status) return detailOf(tx, scope, eventId, taskId)
        await tx.update(tasks).set({ status: input.status, completedAt: input.status === 'done' ? sql`now()` : null,
          version: sql`${tasks.version} + 1` }).where(and(inOrganization(scope), eq(tasks.id, taskId)))
        await record(tx, scope, taskId, 'status_changed', { status: { from: row.status, to: input.status } })
        return detailOf(tx, scope, eventId, taskId)
      })
    },
    // 업무와 처리 기록을 함께 지우고 남은 목록을 준다.
    async remove(scope: TaskScope, eventId: string, taskId: string, input: DeleteTaskRequest): Promise<EventTasksResponse> {
      await db.transaction(async tx => {
        await requireActiveEvents(tx, scope.organizationId, [eventId])
        const row = await lockTask(tx, scope, eventId, taskId)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        await tx.delete(taskEvents).where(and(eq(taskEvents.organizationId, scope.organizationId), eq(taskEvents.taskId, taskId)))
        await tx.delete(tasks).where(and(inOrganization(scope), eq(tasks.id, taskId)))
      })
      return list(scope, eventId)
    },
  }
}
