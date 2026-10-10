import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { dateFromKorean, koreanOf, type CheckInScanResponse, type CreateRegistrationFormRequest, type FeeAccount, type MyPayment, type MyRegistration, type PublicRegistrationEvent,
  type PublicRegistrationForm, type RegisterRequest, type RegistrationCreated, type RegistrationFormView, type RegistrationResponse,
  type UpdateRegistrationFormRequest } from '@vada/contracts'
import { eventFinances, events, organizations, registrationForms, registrations, users } from '../db/schema.js'
import { activeRoster, feeAccountOf, isDuesMember, koreanToday, rematchDues } from '../fees/roster.js'
import { ApiError } from '../http/errors.js'
import { requireOpenEvents } from '../settlement/lock.js'
import { basisOf, owedOf } from './fee.js'
import { purgeExpired } from './purge.js'
import { eventEnd, purgeAfterOf, stateOf } from './state.js'

type Db = PgDatabase<PgQueryResultHKT>
export type RegistrationDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Writer = Pick<Db, 'select' | 'update'>
export interface RegistrationScope { organizationId: string; userId: string }
type Event = typeof events.$inferSelect
type Form = typeof registrationForms.$inferSelect
type FeeSetting = { fee: number; memberFee: number | null }
const confirmers = alias(users, 'payment_confirmers')
const checkers = alias(users, 'check_in_staff')

// 바꿀 때는 행사 행을 FOR NO KEY UPDATE로 잠근다(저장소 관례). 행사를 참조하는 행 추가와는 부딪히지 않고,
// 입금 확인(FOR SHARE)과 M2-2 정산(FOR NO KEY UPDATE)과는 겹치지 않는다.
export async function eventOf(db: Reader, organizationId: string, eventId: string, lock = false) {
  const query = db.select().from(events).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
  const [event] = lock ? await query.for('no key update') : await query
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
// 입금을 확인한 신청의 수와 확인 금액 합. 취소했거나 정보를 지운 신청도 받은 돈으로 센다.
async function paymentsOf(db: Reader, formId: string) {
  const [row] = await db.select({ count: count(), total: sql<string>`coalesce(sum(${registrations.paidAmount}), 0)` }).from(registrations)
    .where(and(eq(registrations.formId, formId), isNotNull(registrations.paidAt)))
  return { count: row?.count ?? 0, total: Number(row?.total ?? 0) }
}
// 참석을 확인한 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다. 취소한 신청에는 참석 기록이 없다(CHECK).
async function checkedInOf(db: Reader, formId: string) {
  const [row] = await db.select({ value: count() }).from(registrations)
    .where(and(eq(registrations.formId, formId), isNotNull(registrations.checkedInAt)))
  return row?.value ?? 0
}
// 금액이 바뀔 때만 본다. 정산 → 입금 확인 → 계좌 → 명단 순서다.
// 명단은 납부자 참가비를 새로 켤 때만 본다. 이미 켠 뒤에 명단 기한이 지나도 다른 설정을 막지 않는다.
async function checkFees(tx: Reader, organizationId: string, eventId: string, today: string, current: FeeSetting, input: FeeSetting,
  formId: string | null) {
  if (current.fee === input.fee && current.memberFee === input.memberFee) return
  const [finance] = await tx.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
  if (finance?.settledAt) throw new ApiError('EVENT_SETTLED', 409)
  if (formId !== null && (await paymentsOf(tx, formId)).count > 0) throw new ApiError('FEE_LOCKED', 409)
  if (input.fee > 0 && !await feeAccountOf(tx, organizationId)) throw new ApiError('FEE_ACCOUNT_REQUIRED', 409)
  if (current.memberFee === null && input.memberFee !== null && !await activeRoster(tx, organizationId, today)) {
    throw new ApiError('DUES_ROSTER_REQUIRED', 409)
  }
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

function formView(form: Form, event: Event, total: number, payments: RegistrationFormView['payments'], checkedIn: number, now: Date):
  RegistrationFormView {
  const purgeAfter = purgeAfterOf(endOf(event))
  return {
    id: form.id, code: form.code, accepting: form.accepting, opensAt: form.opensAt && koreanOf(form.opensAt), closesAt: koreanOf(form.closesAt),
    capacity: form.capacity, notice: form.notice, collectPhone: form.collectPhone, version: form.version, state: stateOf(form, total, now),
    count: total, purgeAfter: koreanDay(purgeAfter), purged: purgeAfter <= now, updatedAt: form.updatedAt.toISOString(),
    fee: form.fee, memberFee: form.memberFee, payments, checkedIn,
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
// 내 신청의 참가비. 참가비가 0원이고 납부자 참가비도 없고 입금 확인도 없으면 없다.
// 계좌는 낼 돈이 있고 입금 확인 전일 때만 알린다.
function paymentOf({ registration, form }: Found, account: FeeAccount | null): MyPayment | null {
  if (form.fee === 0 && form.memberFee === null && registration.paidAt === null) return null
  const fee = owedOf(form, registration)
  return { basis: basisOf(form, registration), fee, paidAt: registration.paidAt && koreanOf(registration.paidAt),
    account: registration.paidAt === null && fee > 0 ? account : null }
}

export function createRegistrationService(db: RegistrationDatabase, now: () => Date) {
  // 운영진 화면이 받는 것. 먼저 보관 기간이 지난 정보를 지운다. 학생회비 명단은 이름과 기한만 준다.
  // 정산이 끝난 행사면 화면이 입금·참가비 버튼을 감춘다(서버는 EVENT_SETTLED로 막는다).
  async function view(tx: Writer, organizationId: string, eventId: string): Promise<RegistrationResponse> {
    const event = await eventOf(tx, organizationId, eventId)
    const form = await formOf(tx, organizationId, eventId)
    const account = await feeAccountOf(tx, organizationId)
    const roster = await activeRoster(tx, organizationId, koreanToday(now()))
    const [finance] = await tx.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
      .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
    const settled = Boolean(finance?.settledAt)
    if (!form) return { form: null, registrations: [], account, roster, settled }
    await purgeExpired(tx, form.id)
    const rows = await tx.select({ registration: registrations, confirmerName: confirmers.name, checkerName: checkers.name }).from(registrations)
      .leftJoin(confirmers, eq(confirmers.id, registrations.paidBy))
      .leftJoin(checkers, eq(checkers.id, registrations.checkedInBy))
      .where(and(eq(registrations.formId, form.id), isNull(registrations.purgedAt)))
      .orderBy(asc(registrations.createdAt), asc(registrations.id))
    return {
      form: formView(form, event, await countOf(tx, form.id), await paymentsOf(tx, form.id), await checkedInOf(tx, form.id), now()),
      registrations: rows.map(({ registration: row, confirmerName, checkerName }) => ({ id: row.id, name: row.name!, studentId: row.studentId!,
        phone: row.phone, createdAt: koreanOf(row.createdAt), duesMember: row.duesMember, fee: owedOf(form, row),
        paid: row.paidAt && row.paidAmount !== null && row.paidBy
          ? { amount: row.paidAmount, at: koreanOf(row.paidAt), by: { id: row.paidBy, name: confirmerName ?? '' } } : null,
        checkedIn: row.checkedInAt && row.checkedInBy
          ? { at: koreanOf(row.checkedInAt), by: { id: row.checkedInBy, name: checkerName ?? '' } } : null })),
      account, roster, settled,
    }
  }
  // 입금 확인·확인 취소·참가비 바꾸기 앞에 부른다.
  // 행사 행을 FOR SHARE로 잠그고 정산 여부를 본다. 그래서 M2-2 정산과 금액 변경(FOR NO KEY UPDATE)과 겹치지 않는다.
  // 그다음 지울 정보를 지우고, 지우지 않은 신청을 찾는다.
  async function entryOf(tx: Writer, scope: RegistrationScope, eventId: string, registrationId: string) {
    await requireOpenEvents(tx, scope.organizationId, [eventId])
    const form = await formOf(tx, scope.organizationId, eventId)
    if (!form) throw new ApiError('NOT_FOUND', 404)
    await purgeExpired(tx, form.id)
    const [row] = await tx.select().from(registrations)
      .where(and(eq(registrations.formId, form.id), eq(registrations.id, registrationId), isNull(registrations.purgedAt)))
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return { form, row }
  }
  // 조건을 건 UPDATE가 0행이면 그사이 다른 요청이 바꾼 것이다. 지금 상태로 알맞은 오류를 낸다.
  async function changed(tx: Reader, registrationId: string): Promise<never> {
    const [current] = await tx.select({ paidAt: registrations.paidAt, purgedAt: registrations.purgedAt }).from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!current || current.purgedAt) throw new ApiError('NOT_FOUND', 404)
    throw new ApiError(current.paidAt ? 'PAYMENT_CONFIRMED' : 'PAYMENT_NOT_CONFIRMED', 409)
  }
  // 참석 확인 앞에 부른다. 참석은 정산과 관계없어 행사 행을 잠그지 않는다. 지울 정보를 먼저 지우고 지우지 않은 신청을 찾는다.
  async function attendeeOf(tx: Writer, scope: RegistrationScope, eventId: string, match: SQL) {
    const form = await formOf(tx, scope.organizationId, eventId)
    if (!form) throw new ApiError('NOT_FOUND', 404)
    await purgeExpired(tx, form.id)
    const [row] = await tx.select().from(registrations).where(and(eq(registrations.formId, form.id), match, isNull(registrations.purgedAt)))
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  // 참석으로 남긴다. 그사이 남이 먼저 확인했으면 false다. 그사이 지워졌으면 NOT_FOUND다.
  async function markCheckedIn(tx: Writer, userId: string, registrationId: string) {
    const [updated] = await tx.update(registrations).set({ checkedInAt: sql`now()`, checkedInBy: userId })
      .where(and(eq(registrations.id, registrationId), isNull(registrations.checkedInAt), isNull(registrations.purgedAt)))
      .returning({ id: registrations.id })
    if (updated) return true
    const [current] = await tx.select({ purgedAt: registrations.purgedAt }).from(registrations).where(eq(registrations.id, registrationId))
    if (!current || current.purgedAt) throw new ApiError('NOT_FOUND', 404)
    return false
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
  // 마감 전이고 입금·참석을 확인하지 않았으면 스스로 취소할 수 있다. 참석 확인 QR의 코드는 토큰의 해시다.
  const myView = (found: Found, account: FeeAccount | null): MyRegistration => {
    const { registration, form, event, organizationName } = found
    return { code: form.code, organizationName, event: publicEvent(event), name: registration.name, studentId: registration.studentId,
      phone: registration.phone, createdAt: koreanOf(registration.createdAt), closesAt: koreanOf(form.closesAt), cancelled: false,
      cancellable: now() < form.closesAt && registration.paidAt === null && registration.checkedInAt === null, payment: paymentOf(found, account),
      checkInCode: registration.tokenHash, checkedInAt: registration.checkedInAt && koreanOf(registration.checkedInAt) }
  }
  return {
    view: (organizationId: string, eventId: string) => db.transaction(tx => view(tx, organizationId, eventId)),
    // 공개 신청 화면. 다른 신청자에 대해서는 남은 자리 수만 준다.
    publicForm: (code: string) => db.transaction(async (tx): Promise<PublicRegistrationForm> => {
      const { form, event, organizationName } = await formByCode(tx, code)
      await purgeExpired(tx, form.id)
      const total = await countOf(tx, form.id)
      return { organizationName, event: publicEvent(event), notice: form.notice, collectPhone: form.collectPhone, state: stateOf(form, total, now()),
        opensAt: form.opensAt && koreanOf(form.opensAt), closesAt: koreanOf(form.closesAt),
        remaining: form.capacity === null ? null : Math.max(0, form.capacity - total), purgeAfter: koreanDay(purgeAfterOf(endOf(event))),
        fee: form.fee, memberFee: form.memberFee }
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
      // 납부자 참가비가 있으면 학번과 이름이 둘 다 맞는 납부자인지 정해 둔다. 명단을 나중에 바꿔도 그대로다.
      const duesMember = form.memberFee === null ? null
        : await isDuesMember(tx, form.organizationId, input.studentId, input.name, koreanToday(now()))
      const token = randomBytes(16).toString('base64url')
      await tx.insert(registrations).values({ id: randomUUID(), organizationId: form.organizationId, formId: form.id, tokenHash: hashOf(token),
        name: input.name, studentId: input.studentId, phone: input.phone, duesMember })
      return { token }
    }),
    lookup: (token: string) => db.transaction(async tx => {
      const current = await mine(tx, token)
      return myView(current, await feeAccountOf(tx, current.form.organizationId))
    }),
    // 신청자가 스스로 취소한다. 마감 전이고 입금·참석을 확인하지 않았을 때만 되고, 정보를 바로 지운다.
    // 입금 확인·참석 확인과 엇갈려도 확인한 신청은 취소하지 않도록 UPDATE에 조건을 건다.
    cancelMine: (token: string) => db.transaction(async (tx): Promise<MyRegistration> => {
      const current = await mine(tx, token, true)
      if (now() >= current.form.closesAt) throw new ApiError('CANCEL_CLOSED', 409)
      if (current.registration.paidAt) throw new ApiError('PAYMENT_CONFIRMED', 409)
      if (current.registration.checkedInAt) throw new ApiError('CHECKED_IN', 409)
      const [cancelled] = await tx.update(registrations)
        .set({ tokenHash: null, name: null, studentId: null, phone: null, cancelledAt: sql`now()`, purgedAt: sql`now()` })
        .where(and(eq(registrations.id, current.registration.id), isNull(registrations.paidAt), isNull(registrations.checkedInAt)))
        .returning({ id: registrations.id })
      if (!cancelled) {
        const [row] = await tx.select({ paidAt: registrations.paidAt }).from(registrations).where(eq(registrations.id, current.registration.id))
        throw new ApiError(row?.paidAt ? 'PAYMENT_CONFIRMED' : 'CHECKED_IN', 409)
      }
      return { ...myView(current, null), name: null, studentId: null, phone: null, cancelled: true, cancellable: false, payment: null,
        checkInCode: null, checkedInAt: null }
    }),
    // 행사 행을 잠가 행사 일시 수정과 엇갈리지 않게 한다.
    create: (scope: RegistrationScope, eventId: string, input: CreateRegistrationFormRequest) => db.transaction(async tx => {
      const event = await eventOf(tx, scope.organizationId, eventId, true)
      if (await formOf(tx, scope.organizationId, eventId)) throw new ApiError('REGISTRATION_EXISTS', 409)
      const closesAt = dateFromKorean(input.closesAt)
      assertDeadline(event, closesAt)
      await checkFees(tx, scope.organizationId, eventId, koreanToday(now()), { fee: 0, memberFee: null }, input, null)
      await tx.insert(registrationForms).values({ id: randomUUID(), organizationId: scope.organizationId, eventId, opensAt: timeOf(input.opensAt), closesAt,
        capacity: input.capacity, notice: input.notice, collectPhone: input.collectPhone, fee: input.fee, memberFee: input.memberFee, createdBy: scope.userId })
      return view(tx, scope.organizationId, eventId)
    }),
    update: (scope: RegistrationScope, eventId: string, input: UpdateRegistrationFormRequest) => db.transaction(async tx => {
      const event = await eventOf(tx, scope.organizationId, eventId, true)
      const form = await formOf(tx, scope.organizationId, eventId, true)
      if (!form) throw new ApiError('NOT_FOUND', 404)
      if (form.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const closesAt = dateFromKorean(input.closesAt)
      assertDeadline(event, closesAt)
      const today = koreanToday(now())
      await checkFees(tx, scope.organizationId, eventId, today, form, input, form.id)
      await tx.update(registrationForms).set({ accepting: input.accepting, opensAt: timeOf(input.opensAt), closesAt, capacity: input.capacity,
        notice: input.notice, collectPhone: input.collectPhone, fee: input.fee, memberFee: input.memberFee, version: form.version + 1 })
        .where(eq(registrationForms.id, form.id))
      // 더는 휴대폰 번호를 받지 않으면 받아 둔 번호도 지운다(최소 수집).
      if (form.collectPhone && !input.collectPhone) {
        await tx.update(registrations).set({ phone: null }).where(and(eq(registrations.formId, form.id), isNotNull(registrations.phone)))
      }
      // 납부자 참가비를 켜면 지금 신청을 명단과 다시 맞추고, 끄면 납부 구분을 지운다.
      if (form.memberFee === null && input.memberFee !== null) await rematchDues(tx, scope.organizationId, form.id, today)
      if (form.memberFee !== null && input.memberFee === null) {
        await tx.update(registrations).set({ duesMember: null }).where(eq(registrations.formId, form.id))
      }
      return view(tx, scope.organizationId, eventId)
    }),
    // 운영진 취소. 그 사람의 정보를 바로 지우고, 취소한 사람을 남긴다. 참석을 확인한 신청은 먼저 참석 확인을 취소해야 한다.
    cancel: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const form = await formOf(tx, scope.organizationId, eventId, true)
      if (!form) throw new ApiError('NOT_FOUND', 404)
      await purgeExpired(tx, form.id)
      const target = and(eq(registrations.formId, form.id), eq(registrations.id, registrationId), isNull(registrations.purgedAt))
      const [row] = await tx.update(registrations).set({ tokenHash: null, name: null, studentId: null, phone: null, cancelledAt: sql`now()`,
        cancelledBy: scope.userId, purgedAt: sql`now()` })
        .where(and(target, isNull(registrations.checkedInAt)))
        .returning({ id: registrations.id })
      if (!row) {
        const [current] = await tx.select({ checkedInAt: registrations.checkedInAt }).from(registrations).where(target)
        throw current?.checkedInAt ? new ApiError('CHECKED_IN', 409) : new ApiError('NOT_FOUND', 404)
      }
      return view(tx, scope.organizationId, eventId)
    }),
    // 입금 확인. 낼 돈이 있는 신청만 확인하고, 그때의 낼 돈을 확인 금액으로 남긴다.
    confirmPayment: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const { form, row } = await entryOf(tx, scope, eventId, registrationId)
      if (row.paidAt) throw new ApiError('PAYMENT_CONFIRMED', 409)
      const amount = owedOf(form, row)
      if (amount <= 0) throw new ApiError('NO_FEE', 409)
      const [updated] = await tx.update(registrations).set({ paidAmount: amount, paidAt: sql`now()`, paidBy: scope.userId })
        .where(and(eq(registrations.id, row.id), isNull(registrations.paidAt), isNull(registrations.purgedAt))).returning({ id: registrations.id })
      if (!updated) await changed(tx, row.id)
      return view(tx, scope.organizationId, eventId)
    }),
    // 확인 취소. 돌려줬거나 잘못 눌렀을 때 쓴다.
    cancelPayment: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const { row } = await entryOf(tx, scope, eventId, registrationId)
      if (!row.paidAt) throw new ApiError('PAYMENT_NOT_CONFIRMED', 409)
      const [updated] = await tx.update(registrations).set({ paidAmount: null, paidAt: null, paidBy: null })
        .where(and(eq(registrations.id, row.id), isNotNull(registrations.paidAt), isNull(registrations.purgedAt))).returning({ id: registrations.id })
      if (!updated) await changed(tx, row.id)
      return view(tx, scope.organizationId, eventId)
    }),
    // 참가비 바꾸기: 학생 문의에 따라 납부 구분을 바꾼다. 납부자 참가비가 있고 입금 확인 전일 때만 된다.
    setDuesMember: (scope: RegistrationScope, eventId: string, registrationId: string, duesMember: boolean) => db.transaction(async tx => {
      const { form, row } = await entryOf(tx, scope, eventId, registrationId)
      if (form.memberFee === null) throw new ApiError('INVALID_STATE', 409)
      if (row.paidAt) throw new ApiError('PAYMENT_CONFIRMED', 409)
      if (row.duesMember !== duesMember) {
        const [updated] = await tx.update(registrations).set({ duesMember })
          .where(and(eq(registrations.id, row.id), isNull(registrations.paidAt), isNull(registrations.purgedAt))).returning({ id: registrations.id })
        if (!updated) await changed(tx, row.id)
      }
      return view(tx, scope.organizationId, eventId)
    }),
    // QR로 참석 확인. 코드는 개인 링크 토큰의 해시다. 이미 참석이면 바꾸지 않고 already로 알린다.
    checkInByCode: (scope: RegistrationScope, eventId: string, code: string) => db.transaction(async (tx): Promise<CheckInScanResponse> => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.tokenHash, code))
      const already = row.checkedInAt !== null || !await markCheckedIn(tx, scope.userId, row.id)
      return { ...await view(tx, scope.organizationId, eventId), checkIn: { registrationId: row.id, already } }
    }),
    // 이름으로 찾아 참석 확인. QR을 못 꺼내는 사람을 위한 것이다.
    checkIn: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.id, registrationId))
      if (row.checkedInAt || !await markCheckedIn(tx, scope.userId, row.id)) throw new ApiError('CHECKED_IN', 409)
      return view(tx, scope.organizationId, eventId)
    }),
    // 참석 확인 취소. 잘못 찍거나 눌렀을 때 쓴다.
    cancelCheckIn: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.id, registrationId))
      if (!row.checkedInAt) throw new ApiError('NOT_CHECKED_IN', 409)
      const [updated] = await tx.update(registrations).set({ checkedInAt: null, checkedInBy: null })
        .where(and(eq(registrations.id, row.id), isNotNull(registrations.checkedInAt), isNull(registrations.purgedAt)))
        .returning({ id: registrations.id })
      if (!updated) {
        const [current] = await tx.select({ purgedAt: registrations.purgedAt }).from(registrations).where(eq(registrations.id, row.id))
        throw !current || current.purgedAt ? new ApiError('NOT_FOUND', 404) : new ApiError('NOT_CHECKED_IN', 409)
      }
      return view(tx, scope.organizationId, eventId)
    }),
  }
}
