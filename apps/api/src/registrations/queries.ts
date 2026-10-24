import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import {
  koreanOf,
  REGISTRATION_FORM_LIST_LIMIT,
  type RegistrationForm,
  type RegistrationFormsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Context } from '../access/permissions.js'
import { account, attendance, event, record, registration, registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { registrationContextOf } from './permission-context.js'
import { actionsOf, factsFrom, listActionsOf } from './policy.js'
import { purgeOnOf } from './purge-date.js'
import { registrationStatusOf, remainingOf } from './state.js'

type Reader = Pick<Db, 'select'>

// 양식과 그 행사의 칸. 학생회 경계는 행사 기록(record)의 학생회 번호로 건다.
function formSelect(db: Reader) {
  return db
    .select({
      id: registrationForm.id,
      eventId: registrationForm.eventId,
      name: registrationForm.name,
      opensAt: registrationForm.opensAt,
      closesAt: registrationForm.closesAt,
      capacity: registrationForm.capacity,
      notice: registrationForm.notice,
      collectsPhone: registrationForm.collectsPhone,
      collectsStudentId: registrationForm.collectsStudentId,
      pausedAt: registrationForm.pausedAt,
      publicCode: registrationForm.publicCode,
      payerFee: registrationForm.payerFee,
      nonPayerFee: registrationForm.nonPayerFee,
      feeAccountId: registrationForm.feeAccountId,
      feeAccountName: account.name,
      eventOwnerId: event.ownerId,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
    })
    .from(registrationForm)
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, event.id))
    .leftJoin(account, eq(account.id, registrationForm.feeAccountId))
}
export type FormRow = Awaited<ReturnType<ReturnType<typeof formSelect>['where']>>[number]

// 이 학생회의 양식 하나. 다른 학생회 양식은 없는 것과 같아 404다.
export async function formRowOf(db: Reader, actor: Actor, formId: string) {
  const [row] = await formSelect(db).where(
    and(eq(record.councilId, actor.councilId), eq(registrationForm.id, formId)),
  )
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 양식마다 취소하지 않은 신청 수와 취소하지 않은 출석 수. 양식 번호가 없으면 0이다.
async function countsOf(db: Reader, formIds: string[]) {
  const result = new Map<string, { applicants: number; attended: number }>()
  if (!formIds.length) return result
  const live = and(inArray(registration.formId, formIds), isNull(registration.cancelledAt))
  const applicants = await db
    .select({ formId: registration.formId, n: count() })
    .from(registration)
    .where(live)
    .groupBy(registration.formId)
  const attended = await db
    .select({ formId: registration.formId, n: count() })
    .from(attendance)
    .innerJoin(registration, eq(registration.id, attendance.registrationId))
    .where(and(live, isNull(attendance.cancelledAt)))
    .groupBy(registration.formId)
  for (const id of formIds) result.set(id, { applicants: 0, attended: 0 })
  for (const row of applicants) result.get(row.formId)!.applicants = row.n
  for (const row of attended) result.get(row.formId)!.attended = row.n
  return result
}

const feeOf = (value: string | null) => (value === null ? null : Number(value))

type Counts = { applicants: number; attended: number }

// 양식 줄 하나. 신청 수와 참석 수, 그 행사의 맥락(책임자, 담당 부서)은 부르는 쪽이 읽어 준다.
function formOf(
  row: FormRow,
  { actor, counts, context, now }: { actor: Actor; counts: Counts; context: Context; now: Date },
  completed: boolean,
): RegistrationForm {
  const { applicants, attended } = counts
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    opensAt: row.opensAt ? koreanOf(row.opensAt) : null,
    closesAt: koreanOf(row.closesAt),
    capacity: row.capacity,
    notice: row.notice,
    collectsPhone: row.collectsPhone,
    collectsStudentId: row.collectsStudentId,
    paused: row.pausedAt !== null,
    publicCode: row.publicCode,
    payerFee: feeOf(row.payerFee),
    nonPayerFee: feeOf(row.nonPayerFee),
    feeAccount:
      row.feeAccountId && row.feeAccountName
        ? { id: row.feeAccountId, name: row.feeAccountName }
        : null,
    status: registrationStatusOf(
      {
        opensAt: row.opensAt,
        closesAt: row.closesAt,
        paused: row.pausedAt !== null,
        capacity: row.capacity,
        applicantCount: applicants,
        eventCompleted: completed,
      },
      now,
    ),
    applicantCount: applicants,
    attendedCount: attended,
    remaining: remainingOf(row.capacity, applicants),
    purgeOn: purgeOnOf(row),
    // 쓰기 동작은 쓰기와 같은 판정에서 나온다(registrations/policy.ts). 완료한 행사는 신청자 보기만 남는다.
    actions: actionsOf(
      actor,
      factsFrom(
        { context, eventCompleted: completed, closesAt: row.closesAt, pausedAt: row.pausedAt },
        now,
      ),
    ),
  }
}

// 행사 하나의 양식 줄들. 맥락은 행사마다 한 번 읽는다.
async function formsOf(
  db: Reader,
  actor: Actor,
  rows: FormRow[],
  now: Date,
): Promise<RegistrationForm[]> {
  const counts = await countsOf(
    db,
    rows.map(row => row.id),
  )
  const completed = await completedEventIdsAmong(
    db,
    rows.map(row => row.eventId),
  )
  const contexts = new Map<string, Context>()
  for (const row of rows)
    if (!contexts.has(row.eventId))
      contexts.set(
        row.eventId,
        await registrationContextOf(db, actor, { id: row.eventId, ownerId: row.eventOwnerId }),
      )
  return rows.map(row =>
    formOf(
      row,
      {
        actor,
        counts: counts.get(row.id)!,
        context: contexts.get(row.eventId)!,
        now,
      },
      completed.has(row.eventId),
    ),
  )
}

// 양식 하나와 그 사람이 할 수 있는 동작. 다른 학생회 양식은 404다.
export async function formDetailOf(
  db: Reader,
  actor: Actor,
  formId: string,
  now: Date,
): Promise<RegistrationForm> {
  const row = await formRowOf(db, actor, formId)
  return (await formsOf(db, actor, [row], now))[0]!
}

// 행사 하나의 양식들(만든 순). 행사가 이 학생회 것이 아니면 404다. 한 개 더 읽어 넘쳤는지 안다.
export async function formListOf(
  db: Reader,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<RegistrationFormsResponse> {
  const target = await eventRowOf(db, actor, eventId)
  const rows = await formSelect(db)
    .where(and(eq(record.councilId, actor.councilId), eq(registrationForm.eventId, target.id)))
    .orderBy(registrationForm.id)
    .limit(REGISTRATION_FORM_LIST_LIMIT + 1)
  // 양식이 없어도 이 행사에서 지금 사람이 할 수 있는 동작을 준다(양식 만들기 버튼). 양식 하나의 동작과 같은 맥락에서 나온다.
  const context = await registrationContextOf(db, actor, target)
  return {
    forms: await formsOf(db, actor, rows.slice(0, REGISTRATION_FORM_LIST_LIMIT), now),
    truncated: rows.length > REGISTRATION_FORM_LIST_LIMIT,
    actions: listActionsOf(
      actor,
      factsFrom(
        {
          context,
          eventCompleted: (await completedEventIdsAmong(db, [target.id])).has(target.id),
          closesAt: null,
          pausedAt: null,
        },
        now,
      ),
    ),
  }
}
