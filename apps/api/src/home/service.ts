import { and, asc, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { eventPhaseOf, HOME_TASKS_MAX, koreanOf, type HomeEvent, type HomeItem, type HomeResponse, type HomeTaskCounts } from '@vada/contracts'
import { departments, tasks } from '../db/schema.js'
import { eventSummaries } from '../events/events.js'
import { taskSummaries, tasksByDue } from '../tasks/service.js'

export type HomeDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 운영 현황(M6). 완료하지 않은 행사에서 멈춘 일과 할 차례를 센다. 수마다 줄을 눌러 가는 화면과 같은 정의를 쓴다.
// 읽기만 하고 잠그지 않는다. 읽는 사이에 다른 사람이 바꾸면 숫자가 잠깐 어긋날 수 있고, 다시 불러오면 맞는다.
export async function homeOf(db: HomeDatabase, organizationId: string, now: Date): Promise<HomeResponse> {
  const moment = koreanOf(now)
  const today = moment.slice(0, 10)
  // 시작일 이른 순, 날짜 미정은 뒤. 같으면 행사 목록 순서(만든 순 역순) 그대로다(정렬은 안정적이다).
  const active = (await eventSummaries(db, organizationId)).filter(event => !event.completedAt)
    .sort((a, b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999'))
  const ids = active.map(event => event.id)
  const position = new Map(ids.map((id, index) => [id, index]))
  const departmentRows = await db.select({ id: departments.id, name: departments.name, isLeadership: departments.isLeadership,
    handlesFinance: departments.handlesFinance }).from(departments).where(eq(departments.organizationId, organizationId))
    .orderBy(desc(departments.isLeadership), asc(departments.name), asc(departments.id))

  // 업무(M4). 지연은 완료가 아니고 마감일이 오늘보다 앞이다(마감일 당일은 아니다).
  const ofActive = and(eq(tasks.organizationId, organizationId), inArray(tasks.eventId, ids))
  const open = sql`${tasks.status} <> 'done'`
  const counted = {
    open: sql<number>`(count(*) filter (where ${open}))::int`,
    overdue: sql<number>`(count(*) filter (where ${open} and ${tasks.dueOn} < ${today}::date))::int`,
    done: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
  }
  const perEvent = await db.select({ eventId: tasks.eventId, total: sql<number>`count(*)::int`, ...counted,
    unassigned: sql<number>`(count(*) filter (where ${open} and ${tasks.assigneeId} is null))::int` })
    .from(tasks).where(ofActive).groupBy(tasks.eventId)
  const perDepartment = await db.select({ departmentId: tasks.departmentId, ...counted }).from(tasks).where(ofActive).groupBy(tasks.departmentId)
  const overdue = await taskSummaries(db, and(ofActive, ne(tasks.status, 'done'), lt(tasks.dueOn, today)), tasksByDue, HOME_TASKS_MAX + 1)
  const unassigned = await db.select({ eventId: tasks.eventId, departmentId: tasks.departmentId, departmentName: departments.name,
    count: sql<number>`count(*)::int` }).from(tasks)
    .leftJoin(departments, and(eq(departments.organizationId, tasks.organizationId), eq(departments.id, tasks.departmentId)))
    .where(and(ofActive, ne(tasks.status, 'done'), isNull(tasks.assigneeId)))
    .groupBy(tasks.eventId, tasks.departmentId, departments.name)
  const countsOf = (departmentId: string | null): HomeTaskCounts => {
    const row = perDepartment.find(entry => entry.departmentId === departmentId)
    return { open: row?.open ?? 0, overdue: row?.overdue ?? 0, done: row?.done ?? 0 }
  }

  const work = new Map(perEvent.map(row => [row.eventId, row]))
  const events: HomeEvent[] = active.map(event => {
    const row = work.get(event.id)
    return { event, phase: eventPhaseOf(event, moment) as HomeEvent['phase'],
      tasks: { total: row?.total ?? 0, done: row?.done ?? 0, overdue: row?.overdue ?? 0, unassigned: row?.unassigned ?? 0 },
      registration: null, settled: false }
  })
  const items: HomeItem[] = []
  for (const task of overdue.slice(0, HOME_TASKS_MAX)) items.push({ kind: 'task_overdue', eventId: task.event.id, task })
  // 행사 순서, 같은 행사에서는 부서 이름 순(담당 부서 없음은 뒤)
  unassigned.sort((a, b) => position.get(a.eventId)! - position.get(b.eventId)!
    || (a.departmentName ?? '￿').localeCompare(b.departmentName ?? '￿'))
  for (const row of unassigned) items.push({ kind: 'tasks_unassigned', eventId: row.eventId, count: row.count,
    department: row.departmentId !== null && row.departmentName !== null ? { id: row.departmentId, name: row.departmentName } : null })
  return {
    today, events, items,
    departments: departmentRows.map(row => ({ ...row, tasks: countsOf(row.id) })),
    unownedTasks: countsOf(null),
    counts: { completion_pending: 0, settlement_pending: 0, purchases_pending: 0, purchases_late: 0, expense_no_evidence: 0, fees_unconfirmed: 0,
      task_overdue: perEvent.reduce((total, row) => total + row.overdue, 0),
      tasks_unassigned: perEvent.reduce((total, row) => total + row.unassigned, 0) },
    truncated: overdue.length > HOME_TASKS_MAX,
  }
}
