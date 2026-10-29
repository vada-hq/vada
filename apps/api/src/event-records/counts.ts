import { and, eq, exists, inArray, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  attendance,
  budgetItem,
  department,
  expense,
  meeting,
  record,
  registration,
  registrationForm,
  request,
  task,
} from '../db/schema.js'
import { countAll, sumOf } from '../db/sums.js'
import type { Db } from '../db/types.js'

// 기록 메뉴의 셈을 행사 여럿에 한 번씩 묶어 센다(목록이 행사마다 다시 묻지 않게). 상세는 행사 하나로 부른다.
// 줄마다 그 기록의 학생회로 거른다. 행사 번호는 부르는 쪽이 이 학생회 것만 넘긴다. 기록 모듈(records/same-council.ts)이
// 다른 학생회 기록을 가리키지 못하게 막지만, 이 셈은 가리킨 쪽의 학생회도 다시 본다(이름·수가 새지 않게).
const attendanceRecord = alias(record, 'record_attendance')
const formRecord = alias(record, 'record_form')

type Reader = Pick<Db, 'select'>
export type RecordScope = { councilId: string; eventIds: string[] }

const PERCENT = 100

// 정수 퍼센트(반올림). 분모가 0이면 없다. 결산의 집행률(closing/numbers.ts)과 같은 반올림이다.
export const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * PERCENT) / whole) : null

const byEvent = <T>(rows: ({ eventId: string | null } & T)[]) =>
  new Map(rows.flatMap(({ eventId, ...rest }) => (eventId ? [[eventId, rest as T]] : [])))

export type RegistrationCounts = { total: number; cancelled: number; attended: number }

// 행사의 참가 신청(그 행사 양식들의 신청): 전체(취소 포함), 취소, 출석. 출석은 신청 양식의 attendedCount와 같은 셈이다
// (취소하지 않은 신청의 취소하지 않은 출석). 1년 뒤 비우기는 이름·학번·휴대폰만 비우고 행을 남겨 수는 그대로다. 이름은 읽지 않는다.
export async function registrationCountsByEvent(db: Reader, scope: RecordScope) {
  if (!scope.eventIds.length) return new Map<string, RegistrationCounts>()
  const attended = exists(
    db
      .select({ one: sql`1` })
      .from(attendance)
      .innerJoin(attendanceRecord, eq(attendanceRecord.id, attendance.id))
      .where(
        and(
          eq(attendance.registrationId, registration.id),
          isNull(attendance.cancelledAt),
          eq(attendance.result, 'attended'),
          eq(attendanceRecord.councilId, scope.councilId),
        ),
      ),
  )
  const rows = await db
    .select({
      eventId: registrationForm.eventId,
      total: countAll,
      cancelled:
        sql<number>`count(*) filter (where ${registration.cancelledAt} is not null)`.mapWith(
          Number,
        ),
      attended:
        sql<number>`count(*) filter (where ${registration.cancelledAt} is null and ${attended})`.mapWith(
          Number,
        ),
    })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(record, eq(record.id, registration.id))
    .innerJoin(formRecord, eq(formRecord.id, registrationForm.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(formRecord.councilId, scope.councilId),
        inArray(registrationForm.eventId, scope.eventIds),
      ),
    )
    .groupBy(registrationForm.eventId)
  return byEvent<RegistrationCounts>(rows)
}

// 예산과 실제 지출(원). 정산(settlement/queries.ts settlementOf)의 budget.expense(이 행사 지출 예산 항목 금액 합)와
// actual.expense(취소하지 않은 이 행사 지출 합)와 같은 셈이다. 시험이 정산 응답과 맞댄다.
export async function moneyByEvent(db: Reader, scope: RecordScope) {
  const result = new Map<string, { budget: number; actual: number }>()
  if (!scope.eventIds.length) return result
  const planned = await db
    .select({ eventId: budgetItem.eventId, total: sumOf(budgetItem.amount) })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(budgetItem.eventId, scope.eventIds),
        eq(budgetItem.type, 'expense'),
      ),
    )
    .groupBy(budgetItem.eventId)
  const spent = await db
    .select({ eventId: expense.eventId, total: sumOf(expense.amount) })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(expense.eventId, scope.eventIds),
        isNull(expense.cancelledAt),
      ),
    )
    .groupBy(expense.eventId)
  for (const id of scope.eventIds) result.set(id, { budget: 0, actual: 0 })
  for (const row of planned) if (row.eventId) result.get(row.eventId)!.budget = row.total
  for (const row of spent) if (row.eventId) result.get(row.eventId)!.actual = row.total
  return result
}

// 담당 부서: 이 행사에 이은 취소하지 않은 업무를 맡은 부서 이름, 중복 없이 이름순. 행사 머리(header.ts)는 끝나지 않은 업무만 보지만
// 완료한 행사는 업무가 대개 끝나 있어, 기록은 끝난 업무의 부서까지 센다.
export async function departmentsByEvent(db: Reader, scope: RecordScope) {
  const result = new Map<string, string[]>()
  if (!scope.eventIds.length) return result
  const rows = await db
    .select({ eventId: task.eventId, name: department.name })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .innerJoin(
      department,
      and(eq(department.id, task.departmentId), eq(department.councilId, scope.councilId)),
    )
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(task.eventId, scope.eventIds),
        isNull(task.cancelledAt),
      ),
    )
    .groupBy(task.eventId, department.name)
  for (const row of rows) {
    if (!row.eventId) continue
    result.set(row.eventId, [...(result.get(row.eventId) ?? []), row.name])
  }
  for (const names of result.values()) names.sort((a, b) => a.localeCompare(b, 'ko'))
  return result
}

// 근거 자료의 회의·구매 요청 수. 취소한 것은 세지 않는다. 업무 수는 taskCountsByEvent(events/queries.ts)가 센다.
export async function sourceCountsByEvent(db: Reader, scope: RecordScope) {
  const result = new Map<string, { meetings: number; purchases: number }>()
  if (!scope.eventIds.length) return result
  const meetings = await db
    .select({ eventId: meeting.eventId, n: countAll })
    .from(meeting)
    .innerJoin(record, eq(record.id, meeting.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(meeting.eventId, scope.eventIds),
        isNull(meeting.cancelledAt),
      ),
    )
    .groupBy(meeting.eventId)
  const purchases = await db
    .select({ eventId: request.eventId, n: countAll })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(request.eventId, scope.eventIds),
        isNull(request.cancelledAt),
      ),
    )
    .groupBy(request.eventId)
  for (const id of scope.eventIds) result.set(id, { meetings: 0, purchases: 0 })
  for (const row of meetings) if (row.eventId) result.get(row.eventId)!.meetings = row.n
  for (const row of purchases) if (row.eventId) result.get(row.eventId)!.purchases = row.n
  return result
}
