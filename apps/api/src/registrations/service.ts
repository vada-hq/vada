import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { dateFromKorean, koreanOf, type CreateRegistrationFormRequest, type RegistrationFormView, type RegistrationResponse,
  type UpdateRegistrationFormRequest } from '@vada/contracts'
import { events, registrationForms, registrations } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { purgeExpired } from './purge.js'
import { eventEnd, purgeAfterOf, stateOf } from './state.js'

type Db = PgDatabase<PgQueryResultHKT>
export type RegistrationDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Writer = Pick<Db, 'select' | 'update'>
export interface RegistrationScope { organizationId: string; userId: string }
type Event = typeof events.$inferSelect
type Form = typeof registrationForms.$inferSelect

export async function eventOf(db: Reader, organizationId: string, eventId: string, lock = false) {
  const query = db.select().from(events).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
  const [event] = lock ? await query.for('update') : await query
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event
}
async function formOf(db: Reader, organizationId: string, eventId: string, lock = false) {
  const query = db.select().from(registrationForms)
    .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
  const [form] = lock ? await query.for('update') : await query
  return form
}
// 취소하지 않은 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다.
export async function countOf(db: Reader, formId: string) {
  const [row] = await db.select({ value: count() }).from(registrations)
    .where(and(eq(registrations.formId, formId), isNull(registrations.cancelledAt)))
  return row?.value ?? 0
}
// 행사 끝: 참가 신청이 있는 행사는 늘 시작 일시가 있다.
export function endOf(event: Pick<Event, 'startsAt' | 'endsAt'>) {
  const end = eventEnd(event)
  if (!end) throw new ApiError('EVENT_TIME_REQUIRED', 409)
  return end
}
// 마감은 행사 끝까지다. 행사 당일 현장 신청도 받을 수 있게 행사 끝과 같아도 된다.
function assertDeadline(event: Event, closesAt: Date) {
  if (closesAt > endOf(event)) throw new ApiError('DEADLINE_AFTER_EVENT', 409)
}
export const koreanDay = (date: Date) => koreanOf(date).slice(0, 10)
const timeOf = (value: string | null) => value === null ? null : dateFromKorean(value)

function formView(form: Form, event: Event, total: number, now: Date): RegistrationFormView {
  const purgeAfter = purgeAfterOf(endOf(event))
  return {
    id: form.id, code: form.code, accepting: form.accepting, opensAt: form.opensAt && koreanOf(form.opensAt), closesAt: koreanOf(form.closesAt),
    capacity: form.capacity, notice: form.notice, collectPhone: form.collectPhone, version: form.version, state: stateOf(form, total, now),
    count: total, purgeAfter: koreanDay(purgeAfter), purged: purgeAfter <= now, updatedAt: form.updatedAt.toISOString(),
  }
}

export function createRegistrationService(db: RegistrationDatabase, now: () => Date) {
  // 운영진 화면이 받는 것. 먼저 보관 기간이 지난 정보를 지운다.
  async function view(tx: Writer, organizationId: string, eventId: string): Promise<RegistrationResponse> {
    const event = await eventOf(tx, organizationId, eventId)
    const form = await formOf(tx, organizationId, eventId)
    if (!form) return { form: null, registrations: [] }
    await purgeExpired(tx, form.id)
    const rows = await tx.select().from(registrations)
      .where(and(eq(registrations.formId, form.id), isNull(registrations.purgedAt)))
      .orderBy(asc(registrations.createdAt), asc(registrations.id))
    return {
      form: formView(form, event, await countOf(tx, form.id), now()),
      registrations: rows.map(row => ({ id: row.id, name: row.name!, studentId: row.studentId!, phone: row.phone, createdAt: koreanOf(row.createdAt) })),
    }
  }
  return {
    view: (organizationId: string, eventId: string) => db.transaction(tx => view(tx, organizationId, eventId)),
    // 행사 행을 잠가 행사 일시 수정과 엇갈리지 않게 한다.
    create: (scope: RegistrationScope, eventId: string, input: CreateRegistrationFormRequest) => db.transaction(async tx => {
      const event = await eventOf(tx, scope.organizationId, eventId, true)
      if (await formOf(tx, scope.organizationId, eventId)) throw new ApiError('REGISTRATION_EXISTS', 409)
      const closesAt = dateFromKorean(input.closesAt)
      assertDeadline(event, closesAt)
      await tx.insert(registrationForms).values({ id: randomUUID(), organizationId: scope.organizationId, eventId, opensAt: timeOf(input.opensAt), closesAt,
        capacity: input.capacity, notice: input.notice, collectPhone: input.collectPhone, createdBy: scope.userId })
      return view(tx, scope.organizationId, eventId)
    }),
    update: (scope: RegistrationScope, eventId: string, input: UpdateRegistrationFormRequest) => db.transaction(async tx => {
      const event = await eventOf(tx, scope.organizationId, eventId, true)
      const form = await formOf(tx, scope.organizationId, eventId, true)
      if (!form) throw new ApiError('NOT_FOUND', 404)
      if (form.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const closesAt = dateFromKorean(input.closesAt)
      assertDeadline(event, closesAt)
      await tx.update(registrationForms).set({ accepting: input.accepting, opensAt: timeOf(input.opensAt), closesAt, capacity: input.capacity,
        notice: input.notice, collectPhone: input.collectPhone, version: form.version + 1 }).where(eq(registrationForms.id, form.id))
      // 더는 휴대폰 번호를 받지 않으면 받아 둔 번호도 지운다(최소 수집).
      if (form.collectPhone && !input.collectPhone) {
        await tx.update(registrations).set({ phone: null }).where(and(eq(registrations.formId, form.id), isNotNull(registrations.phone)))
      }
      return view(tx, scope.organizationId, eventId)
    }),
    // 운영진 취소. 그 사람의 정보를 바로 지우고, 취소한 사람을 남긴다.
    cancel: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const form = await formOf(tx, scope.organizationId, eventId, true)
      if (!form) throw new ApiError('NOT_FOUND', 404)
      await purgeExpired(tx, form.id)
      const [row] = await tx.update(registrations).set({ tokenHash: null, name: null, studentId: null, phone: null, cancelledAt: sql`now()`,
        cancelledBy: scope.userId, purgedAt: sql`now()` })
        .where(and(eq(registrations.formId, form.id), eq(registrations.id, registrationId), isNull(registrations.purgedAt)))
        .returning({ id: registrations.id })
      if (!row) throw new ApiError('NOT_FOUND', 404)
      return view(tx, scope.organizationId, eventId)
    }),
  }
}
