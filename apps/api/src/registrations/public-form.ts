import { and, count, eq, isNull } from 'drizzle-orm'
import { koreanOf, PUBLIC_CODE_PATTERN, type PublicRegistrationForm } from '@vada/contracts'
import { council, event, record, registration, registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { purgeOnOf } from './purge-date.js'
import { questionsOfForm } from './questions.js'
import { registrationStatusOf, remainingOf } from './state.js'

const koreanOrNull = (value: Date | null) => (value ? koreanOf(value) : null)
const feeOf = (value: string | null) => (value === null ? null : Number(value))

// 코드가 가리키는 양식과 그 행사, 학생회 이름. 응답에 담는 칸은 publicFormOf가 하나씩 고른다(계좌, 신청자, 운영진, 내부 번호는 담지 않는다).
// 신청(apply.ts)이 학생회 번호와 계좌 번호를 쓰므로 여기서 함께 읽는다.
export async function publicRowOf(db: Pick<Db, 'select'>, code: string) {
  const [row] = await db
    .select({
      id: registrationForm.id,
      councilId: record.councilId,
      eventId: event.id,
      feeAccountId: registrationForm.feeAccountId,
      councilName: council.name,
      councilClosingAt: council.closingRequestedAt,
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
      collectsStudentId: registrationForm.collectsStudentId,
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

// 마감과 같이 받지 않는 양식인가: 완료한 행사(RULE-11)와 그만둔다고 알린 학생회(DEC-55)의 양식이다. 신청(apply.ts)도 같은 판단을 쓴다.
export const stopsTaking = (row: { councilClosingAt: Date | null }, eventCompleted: boolean) =>
  eventCompleted || row.councilClosingAt !== null

// 취소하지 않은 신청 수
export async function applicantCountOf(db: Pick<Db, 'select'>, formId: string) {
  const [applicants] = await db
    .select({ n: count() })
    .from(registration)
    .where(and(eq(registration.formId, formId), isNull(registration.cancelledAt)))
  return applicants?.n ?? 0
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
  const applicantCount = await applicantCountOf(db, row.id)
  // DEC-93의 초안은 멈춘 채 신청이 0명인 양식이다. 미리보기 자료는 운영진 경로에서만 읽는다.
  if (row.pausedAt !== null && applicantCount === 0) throw new ApiError('REGISTRATION_NOT_OPEN')
  const completed = await completedEventIdsAmong(db, [row.eventId])
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
    // 완료한 행사와 그만두는 학생회의 양식은 받지 않는다(신청은 REGISTRATION_NOT_OPEN). 운영진 응답과 같은 함수가 센다.
    status: registrationStatusOf(
      {
        opensAt: row.opensAt,
        closesAt: row.closesAt,
        paused: row.pausedAt !== null,
        capacity: row.capacity,
        applicantCount,
        eventCompleted: stopsTaking(row, completed.has(row.eventId)),
      },
      now,
    ),
    remaining: remainingOf(row.capacity, applicantCount),
    payerFee,
    nonPayerFee,
    // 양식의 학번 받기(DEC-75). 두 참가비가 다르면 DB CHECK가 받기로 묶는다.
    collectsStudentId: row.collectsStudentId,
    collectsPhone: row.collectsPhone,
    // 질문 제목은 화면 고지의 받는 항목에 그대로 실린다(DEC-93). 선택지 번호는 신청 본문이 쓴다.
    questions: await questionsOfForm(db, row.id),
    purgeOn: purgeOnOf({ ...row, eventStartsAt: row.eventStartsAt, eventEndsAt: row.eventEndsAt }),
  }
}
