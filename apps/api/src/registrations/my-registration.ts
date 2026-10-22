import { and, eq, isNull } from 'drizzle-orm'
import { koreanOf, qrTextOf, type MyRegistration } from '@vada/contracts'
import {
  account,
  attendance,
  council,
  event,
  record,
  registration,
  registrationForm,
  registrationLink,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { hashOfToken } from './link.js'
import { purgeOnOf } from './purge-date.js'

type Reader = Pick<Db, 'select'>

const koreanOrNull = (value: Date | null) => (value ? koreanOf(value) : null)

// 개인 링크 토큰이 가리키는 취소하지 않은 신청과 그 양식. 모르는 토큰, 취소했거나 비운 신청(링크가 지워졌다)은 모두 없다(null)이다.
// 계좌는 신청의 적용 참가비가 0보다 클 때만 읽는다(공개 응답에 낼 때 줄이 아니라 이 칸으로 가른다).
export async function mineRowOf(db: Reader, token: string) {
  const [row] = await db
    .select({
      id: registration.id,
      name: registration.name,
      studentId: registration.studentId,
      phone: registration.phone,
      appliedFee: registration.appliedFee,
      councilName: council.name,
      eventName: event.name,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      eventPlace: event.place,
      formName: registrationForm.name,
      opensAt: registrationForm.opensAt,
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
    .innerJoin(record, eq(record.id, event.id))
    .innerJoin(council, eq(council.id, record.councilId))
    .leftJoin(account, eq(account.id, registrationForm.feeAccountId))
    .where(
      and(eq(registrationLink.tokenHash, hashOfToken(token)), isNull(registration.cancelledAt)),
    )
  // 이름이 비었으면 기한이 지나 지운 신청이다.
  return row && row.name !== null ? { ...row, name: row.name } : null
}

// 출석 확인이 취소되지 않고 남아 있는지
export async function isAttended(db: Reader, registrationId: string) {
  const [row] = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(eq(attendance.registrationId, registrationId), isNull(attendance.cancelledAt)))
  return row !== undefined
}

// 개인 링크로 보는 내 신청. 토큰을 가진 사람 자신의 것이라 이름·학번·휴대폰과 계좌를 담는다.
export async function lookupMine(db: Reader, token: string, now: Date): Promise<MyRegistration> {
  const row = await mineRowOf(db, token)
  if (!row) throw new ApiError('NOT_FOUND')
  const attended = await isAttended(db, row.id)
  const appliedFee = Number(row.appliedFee)
  const hasAccount = row.bank !== null && row.accountNumber !== null && row.holder !== null
  return {
    councilName: row.councilName,
    event: {
      name: row.eventName,
      startsAt: koreanOrNull(row.eventStartsAt),
      endsAt: koreanOrNull(row.eventEndsAt),
      place: row.eventPlace,
    },
    form: {
      name: row.formName,
      opensAt: koreanOrNull(row.opensAt),
      closesAt: koreanOf(row.closesAt),
      notice: row.notice,
    },
    mine: { name: row.name, studentId: row.studentId, phone: row.phone },
    appliedFee,
    account:
      appliedFee > 0 && hasAccount
        ? { bank: row.bank!, accountNumber: row.accountNumber!, holder: row.holder! }
        : null,
    qrText: qrTextOf(row.tokenHash),
    attended,
    cancellable: !attended && now.getTime() < row.closesAt.getTime(),
    purgeOn: purgeOnOf({
      eventEndsAt: row.eventEndsAt,
      eventStartsAt: row.eventStartsAt,
      closesAt: row.closesAt,
    }),
  }
}
