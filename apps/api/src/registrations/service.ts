import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { dateFromKorean, koreanOf, type CreateRegistrationFormRequest, type MyRegistration, type PublicRegistrationEvent,
  type PublicRegistrationForm, type RegisterRequest, type RegistrationCreated, type RegistrationFormView, type RegistrationResponse,
  type UpdateRegistrationFormRequest } from '@vada/contracts'
import { events, organizations, registrationForms, registrations } from '../db/schema.js'
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

// 개인 링크 토큰은 해시만 저장한다.
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex')
const publicEvent = (event: Event): PublicRegistrationEvent => ({ name: event.name, startsAt: event.startsAt && koreanOf(event.startsAt),
  endsAt: event.endsAt && koreanOf(event.endsAt), place: event.place })
// 공개 링크 코드로 찾는다. 신청을 넣거나 빼는 요청은 참가 신청 행을 잠가 정원을 지킨다.
async function formByCode(db: Reader, code: string, lock = false) {
  const query = db.select({ form: registrationForms, event: events, organizationName: organizations.name }).from(registrationForms)
    .innerJoin(events, and(eq(events.organizationId, registrationForms.organizationId), eq(events.id, registrationForms.eventId)))
    .innerJoin(organizations, eq(organizations.id, registrationForms.organizationId))
    .where(eq(registrationForms.code, code))
  const [row] = lock ? await query.for('update', { of: registrationForms }) : await query
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}
// 개인 링크 토큰으로 찾는다. 취소했거나 보관 기간이 지나 지운 신청은 토큰이 없어 찾을 수 없다.
async function registrationByToken(db: Reader, token: string, lock = false) {
  const query = db.select({ registration: registrations, form: registrationForms, event: events, organizationName: organizations.name })
    .from(registrations)
    .innerJoin(registrationForms, and(eq(registrationForms.organizationId, registrations.organizationId), eq(registrationForms.id, registrations.formId)))
    .innerJoin(events, and(eq(events.organizationId, registrationForms.organizationId), eq(events.id, registrationForms.eventId)))
    .innerJoin(organizations, eq(organizations.id, registrations.organizationId))
    .where(eq(registrations.tokenHash, hashOf(token)))
  const [row] = lock ? await query.for('update', { of: registrationForms }) : await query
  return row
}
type Found = NonNullable<Awaited<ReturnType<typeof registrationByToken>>>

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
  // 먼저 그 신청의 지울 정보를 지운 뒤 다시 찾는다. 보관 기간이 지났으면 찾을 수 없다.
  async function mine(tx: Writer, token: string, lock = false) {
    const found = await registrationByToken(tx, token, lock)
    if (!found) throw new ApiError('NOT_FOUND', 404)
    await purgeExpired(tx, found.form.id)
    const current = await registrationByToken(tx, token)
    if (!current) throw new ApiError('NOT_FOUND', 404)
    return current
  }
  const myView = ({ registration, form, event, organizationName }: Found): MyRegistration => ({ code: form.code, organizationName,
    event: publicEvent(event), name: registration.name, studentId: registration.studentId, phone: registration.phone,
    createdAt: koreanOf(registration.createdAt), closesAt: koreanOf(form.closesAt), cancelled: false, cancellable: now() < form.closesAt })
  return {
    view: (organizationId: string, eventId: string) => db.transaction(tx => view(tx, organizationId, eventId)),
    // 공개 신청 화면. 다른 신청자에 대해서는 남은 자리 수만 준다.
    publicForm: (code: string) => db.transaction(async (tx): Promise<PublicRegistrationForm> => {
      const { form, event, organizationName } = await formByCode(tx, code)
      await purgeExpired(tx, form.id)
      const total = await countOf(tx, form.id)
      return { organizationName, event: publicEvent(event), notice: form.notice, collectPhone: form.collectPhone, state: stateOf(form, total, now()),
        opensAt: form.opensAt && koreanOf(form.opensAt), closesAt: koreanOf(form.closesAt),
        remaining: form.capacity === null ? null : Math.max(0, form.capacity - total), purgeAfter: koreanDay(purgeAfterOf(endOf(event))) }
    }),
    // 신청. 받는 중이 아니면 막고, 이미 신청한 학번이면 정원이 찼다는 것보다 그것을 먼저 알린다.
    // 받는 중인 신청에는 지울 정보가 없다(마감 ≤ 행사 끝 < 지울 때). 잠금을 쥔 시간을 줄이려고 파기를 부르지 않고 신청 수와 같은 학번을 한 번에 센다.
    register: (code: string, input: RegisterRequest) => db.transaction(async (tx): Promise<RegistrationCreated> => {
      const { form } = await formByCode(tx, code, true)
      const [tally] = await tx.select({
        total: sql<number>`(count(*) FILTER (WHERE ${registrations.cancelledAt} IS NULL))::int`,
        same: sql<number>`(count(*) FILTER (WHERE ${registrations.studentId} = ${input.studentId} AND ${registrations.purgedAt} IS NULL))::int`,
      }).from(registrations).where(eq(registrations.formId, form.id))
      const state = stateOf(form, tally?.total ?? 0, now())
      if (state !== 'open' && state !== 'full') throw new ApiError('REGISTRATION_NOT_OPEN', 409)
      if ((tally?.same ?? 0) > 0) throw new ApiError('ALREADY_REGISTERED', 409)
      if (state === 'full') throw new ApiError('REGISTRATION_FULL', 409)
      // 휴대폰 번호는 받는 신청에서만 받는다. 다르면 운영진이 설정을 바꾸기 전에 연 화면이므로 화면이 설정을 다시 받게 한다.
      if (form.collectPhone !== (input.phone !== null)) throw new ApiError('FORM_CHANGED', 409)
      const token = randomBytes(16).toString('base64url')
      await tx.insert(registrations).values({ id: randomUUID(), organizationId: form.organizationId, formId: form.id, tokenHash: hashOf(token),
        name: input.name, studentId: input.studentId, phone: input.phone })
      return { token }
    }),
    lookup: (token: string) => db.transaction(async tx => myView(await mine(tx, token))),
    // 신청자가 스스로 취소한다. 마감 전까지만 되고, 정보를 바로 지운다.
    cancelMine: (token: string) => db.transaction(async (tx): Promise<MyRegistration> => {
      const current = await mine(tx, token, true)
      if (now() >= current.form.closesAt) throw new ApiError('CANCEL_CLOSED', 409)
      await tx.update(registrations).set({ tokenHash: null, name: null, studentId: null, phone: null, cancelledAt: sql`now()`, purgedAt: sql`now()` })
        .where(eq(registrations.id, current.registration.id))
      return { ...myView(current), name: null, studentId: null, phone: null, cancelled: true, cancellable: false }
    }),
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
