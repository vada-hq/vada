import { and, asc, desc, eq, inArray, isNull, lt, ne, notExists, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { eventPhaseOf, HOME_EXPENSES_MAX, HOME_TASKS_MAX, koreanOf, type HomeEvent, type HomeItem, type HomeResponse,
  type HomeTaskCounts } from '@vada/contracts'
import { departments, eventFinances, expenseReceipts, expenses, purchaseItems, purchaseSubmissions, registrationForms, registrations,
  tasks } from '../db/schema.js'
import { eventSummaries } from '../events/events.js'
import { expenseSummaries } from '../expenses/summaries.js'
import { owedSql } from '../registrations/fee.js'
import { financeNumbersByEvent } from '../settlement/service.js'
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
  const byEvent = (a: { eventId: string }, b: { eventId: string }) => position.get(a.eventId)! - position.get(b.eventId)!
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

  // 정산(M2-2). 정리 중(끝남)인 행사만 정산·완료를 기다린다. 필요한 날 지남·입금 확인 전은 정산 전 행사만 센다.
  const finances = await db.select({ eventId: eventFinances.eventId, settledAt: eventFinances.settledAt }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, organizationId), inArray(eventFinances.eventId, ids)))
  const settled = new Set(finances.filter(row => row.settledAt !== null).map(row => row.eventId))
  const unsettled = ids.filter(id => !settled.has(id))
  const phases = new Map(active.map(event => [event.id, eventPhaseOf(event, moment) as HomeEvent['phase']]))
  const ended = active.filter(event => phases.get(event.id) === 'wrapping')
  const blockers = await financeNumbersByEvent(db, { organizationId }, ended.filter(event => !settled.has(event.id)).map(event => event.id))
  // 끝난 한국 날짜: 끝 일시가 있으면 그 날, 없으면 시작한 날(정리 중이면 시작이 있다)
  const endedOn = (event: (typeof active)[number]) => (event.endsAt ?? event.startsAt!).slice(0, 10)

  // 구매(M1). 승인 대기는 가장 오래된 제출부터, 필요한 날 지남은 승인했고 받지 않았고 필요한 날이 오늘보다 앞인 품목이다.
  const pending = await db.select({ eventId: purchaseItems.eventId, count: sql<number>`count(*)::int`,
    since: sql<Date>`min(${purchaseSubmissions.submittedAt})`.mapWith(purchaseSubmissions.submittedAt) }).from(purchaseItems)
    .innerJoin(purchaseSubmissions, and(eq(purchaseSubmissions.organizationId, purchaseItems.organizationId),
      eq(purchaseSubmissions.id, purchaseItems.submissionId)))
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, ids), eq(purchaseItems.status, 'pending')))
    .groupBy(purchaseItems.eventId)
  const late = await db.select({ eventId: purchaseItems.eventId, count: sql<number>`count(*)::int`,
    neededBy: sql<string>`min(${purchaseItems.neededBy})::text` }).from(purchaseItems)
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, unsettled), eq(purchaseItems.status, 'approved'),
      isNull(purchaseItems.receivedAt), lt(purchaseItems.neededBy, today)))
    .groupBy(purchaseItems.eventId)

  // 증빙 없는 지출(M2-1, 재정 탭·사용 내역과 같은 정의). 상시 운영 지출도 센다. 오래된 결제부터 준다.
  const missing = and(isNull(expenses.voidedAt), or(isNull(expenses.eventId), inArray(expenses.eventId, ids)),
    notExists(db.select({ one: sql`1` }).from(expenseReceipts)
      .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready')))))
  const noEvidence = await expenseSummaries(db, organizationId, missing, HOME_EXPENSES_MAX + 1, 'oldest')
  const [missingTotal] = await db.select({ count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, organizationId), missing))

  // 참가 신청(M3)과 입금 확인 전(참가자 탭의 "입금 전"과 같다). 신청자가 없으면 LEFT JOIN의 빈 줄은 신청 ID가 없어 세지 않는다.
  const forms = await db.select({ eventId: registrationForms.eventId, capacity: registrationForms.capacity, closesAt: registrationForms.closesAt,
    accepting: registrationForms.accepting,
    registered: sql<number>`(count(${registrations.id}) filter (where ${registrations.cancelledAt} is null))::int`,
    unconfirmed: sql<number>`(count(*) filter (where ${registrations.id} is not null and ${registrations.purgedAt} is null
      and ${registrations.paidAt} is null and ${owedSql} > 0))::int` }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), inArray(registrationForms.eventId, ids)))
    .groupBy(registrationForms.id)
  const formOf = new Map(forms.map(row => [row.eventId, row]))
  const fees = forms.filter(row => !settled.has(row.eventId) && row.unconfirmed > 0).sort(byEvent)

  const work = new Map(perEvent.map(row => [row.eventId, row]))
  const events: HomeEvent[] = active.map(event => {
    const row = work.get(event.id)
    const form = formOf.get(event.id)
    return { event, phase: phases.get(event.id)!,
      tasks: { total: row?.total ?? 0, done: row?.done ?? 0, overdue: row?.overdue ?? 0, unassigned: row?.unassigned ?? 0 },
      registration: form ? { registered: form.registered, capacity: form.capacity, closesAt: koreanOf(form.closesAt), accepting: form.accepting } : null,
      settled: settled.has(event.id) }
  })

  // 줄은 HOME_ITEM_KINDS 순서(행사 마무리 → 업무 → 돈)로 넣고, 같은 종류는 오래된 것부터다.
  const items: HomeItem[] = []
  for (const event of ended.filter(entry => settled.has(entry.id))) {
    items.push({ kind: 'completion_pending', eventId: event.id, endedOn: endedOn(event) })
  }
  for (const event of ended.filter(entry => !settled.has(entry.id))) {
    const numbers = blockers.get(event.id)!
    items.push({ kind: 'settlement_pending', eventId: event.id, endedOn: endedOn(event),
      blockers: { missingEvidence: numbers.missingEvidence, pendingRequests: numbers.pendingRequests, unrecordedItems: numbers.unrecordedItems } })
  }
  for (const task of overdue.slice(0, HOME_TASKS_MAX)) items.push({ kind: 'task_overdue', eventId: task.event.id, task })
  // 행사 순서, 같은 행사에서는 부서 이름 순(담당 부서 없음은 뒤)
  unassigned.sort((a, b) => byEvent(a, b) || (a.departmentName ?? '￿').localeCompare(b.departmentName ?? '￿'))
  for (const row of unassigned) items.push({ kind: 'tasks_unassigned', eventId: row.eventId, count: row.count,
    department: row.departmentId !== null && row.departmentName !== null ? { id: row.departmentId, name: row.departmentName } : null })
  for (const row of pending.sort((a, b) => a.since.getTime() - b.since.getTime())) {
    items.push({ kind: 'purchases_pending', eventId: row.eventId, count: row.count, since: row.since.toISOString() })
  }
  for (const row of late.sort((a, b) => a.neededBy.localeCompare(b.neededBy))) {
    items.push({ kind: 'purchases_late', eventId: row.eventId, count: row.count, neededBy: row.neededBy })
  }
  for (const expense of noEvidence.slice(0, HOME_EXPENSES_MAX)) items.push({ kind: 'expense_no_evidence', eventId: expense.event?.id ?? null, expense })
  for (const row of fees) items.push({ kind: 'fees_unconfirmed', eventId: row.eventId, count: row.unconfirmed })

  const total = (list: { count: number }[]) => list.reduce((sum, row) => sum + row.count, 0)
  return {
    today, events, items,
    departments: departmentRows.map(row => ({ ...row, tasks: countsOf(row.id) })),
    unownedTasks: countsOf(null),
    counts: {
      completion_pending: items.filter(item => item.kind === 'completion_pending').length,
      settlement_pending: items.filter(item => item.kind === 'settlement_pending').length,
      task_overdue: perEvent.reduce((sum, row) => sum + row.overdue, 0),
      tasks_unassigned: perEvent.reduce((sum, row) => sum + row.unassigned, 0),
      purchases_pending: total(pending), purchases_late: total(late),
      expense_no_evidence: missingTotal?.count ?? 0,
      fees_unconfirmed: fees.reduce((sum, row) => sum + row.unconfirmed, 0),
    },
    truncated: overdue.length > HOME_TASKS_MAX || noEvidence.length > HOME_EXPENSES_MAX,
  }
}
