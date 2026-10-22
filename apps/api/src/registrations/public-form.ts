import { and, count, eq, isNull } from 'drizzle-orm'
import { koreanOf, PUBLIC_CODE_PATTERN, type PublicRegistrationForm } from '@vada/contracts'
import { council, event, record, registration, registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { purgeOnOf } from './purge-date.js'
import { registrationStatusOf, remainingOf } from './state.js'

const koreanOrNull = (value: Date | null) => (value ? koreanOf(value) : null)
const feeOf = (value: string | null) => (value === null ? null : Number(value))

// 코드가 가리키는 양식과 그 행사, 학생회 이름. 아래 고른 칸이 곧 공개하는 칸이다: 계좌, 신청자, 운영진, 내부 번호는 고르지 않는다.
async function publicRowOf(db: Pick<Db, 'select'>, code: string) {
  const [row] = await db
    .select({
      id: registrationForm.id,
      councilName: council.name,
      eventName: event.name,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      eventPlace: event.place,
      name: registrationForm.name,
      opensAt: registrationForm.opensAt,
      closesAt: registrationForm.closesAt,
      notice: registrationForm.notice,
      capacity: registrationForm.capacity,
      collectsPhone: registrationForm.collectsPhone,
      pausedAt: registrationForm.pausedAt,
      payerFee: registrationForm.payerFee,
      nonPayerFee: registrationForm.nonPayerFee,
    })
    .from(registrationForm)
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, event.id))
    .innerJoin(council, eq(council.id, record.councilId))
    .where(eq(registrationForm.publicCode, code))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 로그인 없이 코드로 읽는 양식.
// 모르는 코드와 형식이 틀린 코드는 가르지 않고 모두 404다. 코드는 대문자로 적히지만 손으로 옮긴 소문자도 받는다.
export async function publicFormOf(
  db: Pick<Db, 'select'>,
  rawCode: string,
  now: Date,
): Promise<PublicRegistrationForm> {
  const code = rawCode.toUpperCase()
  if (!PUBLIC_CODE_PATTERN.test(code)) throw new ApiError('NOT_FOUND')
  const row = await publicRowOf(db, code)
  const [applicants] = await db
    .select({ n: count() })
    .from(registration)
    .where(and(eq(registration.formId, row.id), isNull(registration.cancelledAt)))
  const applicantCount = applicants?.n ?? 0
  const payerFee = feeOf(row.payerFee)
  const nonPayerFee = feeOf(row.nonPayerFee)
  return {
    councilName: row.councilName,
    event: {
      name: row.eventName,
      startsAt: koreanOrNull(row.eventStartsAt),
      endsAt: koreanOrNull(row.eventEndsAt),
      place: row.eventPlace,
    },
    form: {
      name: row.name,
      opensAt: koreanOrNull(row.opensAt),
      closesAt: koreanOf(row.closesAt),
      notice: row.notice,
    },
    status: registrationStatusOf(
      {
        opensAt: row.opensAt,
        closesAt: row.closesAt,
        paused: row.pausedAt !== null,
        capacity: row.capacity,
        applicantCount,
      },
      now,
    ),
    remaining: remainingOf(row.capacity, applicantCount),
    payerFee,
    nonPayerFee,
    // 학번은 두 참가비가 다를 때만 받는다(DEC-62, 개인정보 최소 수집).
    collectsStudentId: payerFee !== nonPayerFee,
    collectsPhone: row.collectsPhone,
    purgeOn: purgeOnOf({ ...row, eventStartsAt: row.eventStartsAt, eventEndsAt: row.eventEndsAt }),
  }
}
