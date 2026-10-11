import { and, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { koreanOf, type EventReportFacts, type EventSummary } from '@vada/contracts'
import { eventFinances, purchaseItems, registrationForms, registrations, tasks } from '../db/schema.js'
import { financeNumbersByEvent } from '../settlement/service.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 결과보고서의 자동 수치(M5b). 기록 목록이 행사 여럿을 한 번에 센다. now는 업무 지연을 가르는 날(한국 날짜)의 기준이다.
// 완료한 행사의 기록을 바꾸는 쓰기는 모두 행사 행을 잠그고 완료를 보고 멈추므로(M5a) 여기서는 잠그지 않는다.
export async function factsByEvent(db: Reader, organizationId: string, list: EventSummary[], now: Date) {
  const facts = new Map<string, EventReportFacts>(list.map(event => [event.id, {
    event: { name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, place: event.place },
    owner: { department: event.ownerDepartment?.name ?? null, person: event.owner?.name ?? null },
    registrations: null, finance: { budget: null, spent: 0 }, tasks: { total: 0, done: 0, late: 0 }, purchases: { requested: 0, approved: 0 },
  }]))
  const ids = [...facts.keys()]
  if (!ids.length) return facts
  const of = (id: string) => facts.get(id)!
  // 신청서가 있으면 신청이 없어도 0명이다(LEFT JOIN의 빈 줄은 신청 ID가 없어 세지 않는다).
  const signups = await db.select({ eventId: registrationForms.eventId,
    registered: sql<number>`(count(${registrations.id}) filter (where ${registrations.cancelledAt} is null))::int`,
    attended: sql<number>`count(${registrations.checkedInAt})::int` }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), inArray(registrationForms.eventId, ids)))
    .groupBy(registrationForms.eventId)
  for (const row of signups) of(row.eventId).registrations = { registered: row.registered, attended: row.attended }
  const budgets = await db.select({ eventId: eventFinances.eventId, budget: eventFinances.budget }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, organizationId), inArray(eventFinances.eventId, ids)))
  for (const row of budgets) of(row.eventId).finance.budget = row.budget
  for (const [id, numbers] of await financeNumbersByEvent(db, { organizationId }, ids)) of(id).finance.spent = numbers.spent
  const today = koreanOf(now).slice(0, 10)
  // 마감일 당일에 끝냈으면 지연이 아니다. 끝낸 날은 한국 날짜로 본다.
  const work = await db.select({ eventId: tasks.eventId, total: sql<number>`count(*)::int`,
    done: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
    late: sql<number>`(count(*) filter (where ${tasks.dueOn} is not null and case when ${tasks.status} = 'done'
      then (${tasks.completedAt} at time zone 'Asia/Seoul')::date > ${tasks.dueOn} else ${tasks.dueOn} < ${today}::date end))::int` })
    .from(tasks).where(and(eq(tasks.organizationId, organizationId), inArray(tasks.eventId, ids))).groupBy(tasks.eventId)
  for (const row of work) of(row.eventId).tasks = { total: row.total, done: row.done, late: row.late }
  const buying = await db.select({ eventId: purchaseItems.eventId,
    requested: sql<number>`(count(*) filter (where ${purchaseItems.status} <> 'draft'))::int`,
    approved: sql<number>`(count(*) filter (where ${purchaseItems.status} = 'approved'))::int` }).from(purchaseItems)
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, ids))).groupBy(purchaseItems.eventId)
  for (const row of buying) of(row.eventId).purchases = { requested: row.requested, approved: row.approved }
  return facts
}
