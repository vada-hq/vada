import { and, eq, isNull } from 'drizzle-orm'
import { koreanOf, qrTextOf, type MyRegistration } from '@vada/contracts'
import {
  account,
  attendance,
  deposit,
  event,
  registration,
  registrationForm,
  registrationLink,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { shownAnswersOf } from './answers.js'
import { hashOfToken } from './link.js'
import { purgeOnOf } from './purge-date.js'
import { isFormClosed } from './state.js'

type Reader = Pick<Db, 'select'>
const koreanOrNull = (value: Date | null) => (value ? koreanOf(value) : null)

// 개인 링크 토큰이 가리키는 취소하지 않은 신청과 그 양식. 모르는 토큰, 취소했거나 비운 신청(링크가 지워졌다)은 모두 없다(null)이다.
// 계좌는 신청의 적용 참가비가 0보다 클 때만 읽는다(공개 응답에 낼 때 줄이 아니라 이 칸으로 가른다).
export async function mineRowOf(db: Reader, token: string) {
  const [row] = await db
    .select({
      id: registration.id,
      formId: registration.formId,
      eventId: registrationForm.eventId,
      name: registration.name,
      studentId: registration.studentId,
      phone: registration.phone,
      appliedFee: registration.appliedFee,
      depositId: deposit.id,
      eventName: event.name,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      eventPlace: event.place,
      closesAt: registrationForm.closesAt,
      notice: registrationForm.notice,
      bank: account.bank,
      accountNumber: account.accountNumber,
      holder: account.holder,
      tokenHash: registrationLink.tokenHash,
    })
    .from(registrationLink)
    .innerJoin(registration, eq(registration.id, registrationLink.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .leftJoin(account, eq(account.id, registrationForm.feeAccountId))
    .leftJoin(
      deposit,
      and(
        eq(deposit.registrationId, registration.id),
        isNull(deposit.cancelledAt),
        isNull(deposit.refundedAt),
      ),
    )
    .where(
      and(eq(registrationLink.tokenHash, hashOfToken(token)), isNull(registration.cancelledAt)),
    )
  // 이름이 비었으면 기한이 지나 지운 신청이다.
  return row && row.name !== null ? { ...row, name: row.name } : null
}

// 취소하지 않은 출석 기록의 결과(참석, 불참, DEC-93). 기록이 없으면 null이다.
export async function attendanceResultOf(db: Reader, registrationId: string) {
  const [row] = await db
    .select({ result: attendance.result })
    .from(attendance)
    .where(and(eq(attendance.registrationId, registrationId), isNull(attendance.cancelledAt)))
  return row ? (row.result as 'attended' | 'absent') : null
}

// 참석이 취소되지 않고 남아 있는지. 불참은 참석이 아니다(신청 취소를 막지 않는다, DEC-93).
export const isAttended = async (db: Reader, registrationId: string) =>
  (await attendanceResultOf(db, registrationId)) === 'attended'

// 개인 링크로 보는 내 신청. 토큰을 가진 사람 자신의 것이라 이름·학번·휴대폰과 계좌를 담는다.
export async function lookupMine(db: Reader, token: string, now: Date): Promise<MyRegistration> {
  const row = await mineRowOf(db, token)
  if (!row) throw new ApiError('NOT_FOUND')
  const attended = await isAttended(db, row.id)
  const completed = (await completedEventIdsAmong(db, [row.eventId])).has(row.eventId)
  const appliedFee = Number(row.appliedFee)
  const hasAccount = row.bank !== null && row.accountNumber !== null && row.holder !== null
  return {
    // 행사 일시·장소는 공개 양식이 이미 싣는 값이다. 지우는 날도 공개 양식과 같은 함수로 센다.
    event: {
      name: row.eventName,
      startsAt: koreanOrNull(row.eventStartsAt),
      endsAt: koreanOrNull(row.eventEndsAt),
      place: row.eventPlace,
    },
    form: { notice: row.notice },
    purgeOn: purgeOnOf(row),
    mine: { name: row.name, studentId: row.studentId, phone: row.phone },
    // 토큰을 가진 본인의 답이라 열람 기록이 없다(이름·학번과 같다).
    answers: (await shownAnswersOf(db, [row])).get(row.id)!,
    appliedFee,
    depositConfirmed: row.depositId !== null,
    account:
      appliedFee > 0 && hasAccount
        ? { bank: row.bank!, accountNumber: row.accountNumber!, holder: row.holder! }
        : null,
    qrText: qrTextOf(row.tokenHash),
    attended,
    cancellable: !attended && !completed && !isFormClosed(row.closesAt, now),
  }
}
