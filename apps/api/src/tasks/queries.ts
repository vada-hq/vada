import { and, asc, eq, exists, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import {
  TASK_DONE_LIMIT,
  TASK_OPEN_LIMIT,
  type TaskDetail,
  type TaskListQuery,
  type TaskStatus,
  type TaskSummary,
  type TaskView,
  type TasksResponse,
} from '@vada/contracts'
import { currentCouncilMembership } from '../access/current-cohort.js'
import type { Actor } from '../access/actor.js'
import {
  cohort,
  councilMembership,
  department,
  event,
  member,
  record,
  recordVersion,
  task,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { actionsOf } from './actions.js'
import { dueDateOf, isOverdue } from './due.js'
import { eventRowOf } from '../events/queries.js'
import { historyOf } from './history.js'

type Reader = Pick<Db, 'select'>

// 담당자가 지금 이 학생회의 운영진인가. 떠난 사람의 업무는 담당자를 남긴 채 '담당자 없음' 탭에 '떠난 사람'으로 보인다(T6).
const assigneeIsCurrent = (db: Reader, actor: Actor, now: Date) =>
  exists(
    db
      .select({ one: sql`1` })
      .from(councilMembership)
      .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
      .where(
        and(
          eq(councilMembership.memberId, task.assigneeId),
          eq(cohort.councilId, actor.councilId),
          currentCouncilMembership(now),
        ),
      ),
  )

// 읽기 바탕(조각 3·4의 쓰기가 같은 줄과 권한 맥락을 다시 쓴다): 이 학생회의 업무와 그 줄에 필요한 이름, 담당자 현재 여부.
// 학생회 경계는 기록(record)의 학생회 번호로 건다. 조건(where)은 부르는 쪽이 inCouncil과 함께 더한다.
export function taskSelect(db: Reader, actor: Actor, now: Date) {
  return db
    .select({
      id: task.id,
      title: task.title,
      body: task.body,
      status: task.status,
      dueAt: task.dueAt,
      departmentId: task.departmentId,
      departmentName: department.name,
      eventId: task.eventId,
      eventName: event.name,
      eventOwnerId: event.ownerId,
      assigneeId: task.assigneeId,
      assigneeName: member.name,
      assigneeCurrent: sql<boolean>`${assigneeIsCurrent(db, actor, now)}`.mapWith(Boolean),
      createdAt: record.createdAt,
    })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .leftJoin(department, eq(department.id, task.departmentId))
    .leftJoin(event, eq(event.id, task.eventId))
    .leftJoin(member, eq(member.id, task.assigneeId))
}

// 이 학생회의 지우지 않은 업무
export const inCouncil = (actor: Actor) =>
  and(eq(record.councilId, actor.councilId), isNull(task.cancelledAt))

export type Row = Awaited<ReturnType<ReturnType<typeof taskSelect>['where']>>[number]

export function summaryOf(actor: Actor, row: Row, now: Date): TaskSummary {
  const status = row.status as TaskStatus
  return {
    id: row.id,
    title: row.title,
    status,
    dueDate: dueDateOf(row.dueAt),
    overdue: isOverdue(row.dueAt, status, now),
    department:
      row.departmentId && row.departmentName
        ? { id: row.departmentId, name: row.departmentName }
        : null,
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
    assignee:
      row.assigneeId && row.assigneeName
        ? { id: row.assigneeId, name: row.assigneeName, current: row.assigneeCurrent }
        : null,
    actions: actionsOf(actor, row),
  }
}

// 나에게 맡긴 업무. 업무 화면의 '내 업무'와 홈이 같이 쓴다.
export const assignedTo = (actor: Actor) => eq(task.assigneeId, actor.memberId)

// 업무 화면의 '담당자 없음'. 담당자 없음, 떠난 담당자, 부서 없는 업무. 홈이 같이 쓴다.
export const unassignedCondition = (db: Reader, actor: Actor, now: Date) =>
  or(
    isNull(task.assigneeId),
    sql`not ${assigneeIsCurrent(db, actor, now)}`,
    isNull(task.departmentId),
  )

function viewCondition(db: Reader, actor: Actor, view: TaskView, now: Date): SQL | undefined {
  if (view === 'mine') return assignedTo(actor)
  if (view === 'all') return undefined
  return unassignedCondition(db, actor, now)
}

// 끝나지 않은 것은 마감 순(없으면 뒤)에 만든 순, 끝남은 마지막으로 바뀐 순이다. 한 개 더 읽어 넘쳤는지 안다.
function listRows(db: Reader, actor: Actor, query: TaskListQuery, now: Date) {
  const scope = and(
    inCouncil(actor),
    viewCondition(db, actor, query.view, now),
    query.status === 'done' ? eq(task.status, 'done') : ne(task.status, 'done'),
    query.event ? eq(task.eventId, query.event) : undefined,
  )
  const base = taskSelect(db, actor, now)
  if (query.status === 'open')
    return base
      .where(scope)
      .orderBy(sql`${task.dueAt} asc nulls last`, asc(record.createdAt), asc(task.id))
      .limit(TASK_OPEN_LIMIT + 1)
  return base
    .innerJoin(
      recordVersion,
      and(eq(recordVersion.recordId, task.id), sql`upper_inf(${recordVersion.valid})`),
    )
    .where(scope)
    .orderBy(sql`lower(${recordVersion.valid}) desc`, asc(task.id))
    .limit(TASK_DONE_LIMIT + 1)
}

export async function taskListOf(
  db: Reader,
  actor: Actor,
  query: TaskListQuery,
  now: Date,
): Promise<TasksResponse> {
  // 다른 학생회 행사와 없는 행사는 404다. 빈 목록으로 답하면 행사가 있는지 드러난다.
  if (query.event) await eventRowOf(db, actor, query.event)
  const rows = await listRows(db, actor, query, now)
  const limit = query.status === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT
  return {
    tasks: rows.slice(0, limit).map(row => summaryOf(actor, row, now)),
    truncated: rows.length > limit,
  }
}

// 이 학생회의 지우지 않은 업무 하나. 다른 학생회 업무와 지운 업무는 없는 것과 같아 404다.
export async function taskRowOf(db: Reader, actor: Actor, taskId: string, now: Date) {
  const [row] = await taskSelect(db, actor, now).where(and(inCouncil(actor), eq(task.id, taskId)))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export async function taskDetailOf(
  db: Reader,
  actor: Actor,
  taskId: string,
  now: Date,
): Promise<TaskDetail> {
  const row = await taskRowOf(db, actor, taskId, now)
  const history = await historyOf(db, taskId)
  return {
    ...summaryOf(actor, row, now),
    body: row.body,
    createdBy: history[0]?.by ?? null,
    createdAt: row.createdAt.toISOString(),
    history,
  }
}
