import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { assertEventOpen } from '../events/completion.js'
import { event, record, registration, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { assertManage } from './permission-context.js'
import { lockRegistration } from './registration-lock.js'

// 운영진이 번호로 가리키는 신청 하나. 학생회 경계는 행사 기록의 학생회 번호로 건다(다른 학생회 신청은 없는 것과 같아 404).
async function rowOf(db: Pick<Db, 'select'>, actor: Actor, registrationId: string) {
  const [row] = await db
    .select({
      id: registration.id,
      formId: registration.formId,
      eventId: registrationForm.eventId,
      ownerId: event.ownerId,
      name: registration.name,
      studentId: registration.studentId,
      appliedFee: registration.appliedFee,
      cancelledAt: registration.cancelledAt,
    })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(registration.id, registrationId), eq(record.councilId, actor.councilId)))
  return row
}

// 취소했거나 기한이 지나 비운 신청(이름이 비었다)은 없는 것과 같다.
const liveOf = <T extends { cancelledAt: Date | null; name: string | null }>(row: T | undefined) =>
  row && row.cancelledAt === null && row.name !== null ? { ...row, name: row.name } : null

// 권한 확인: 대상 행사의 책임자와 담당 부서로 묻는다. 신청 관리와 입금 확인, 환불함이 각자 낸다.
export type RegistrationCheck = (
  db: Pick<Db, 'select'>,
  actor: Actor,
  target: { id: string; ownerId: string | null },
) => Promise<void>

// 권한을 보고 신청 행을 잠근 뒤 다시 읽는다(취소했거나 비운 신청도 돌려준다). 스스로 취소와 같은 순서라 겹쳐도 하나만 된다.
// 다른 학생회 신청은 권한을 묻기 전에 404이고, 같은 학생회 신청은 권한이 없으면 403이다.
export async function lockedRegistration(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  check: RegistrationCheck,
) {
  const first = await rowOf(tx, actor, registrationId)
  if (!first) throw new ApiError('NOT_FOUND')
  await check(tx, actor, { id: first.eventId, ownerId: first.ownerId })
  // 완료한 행사의 신청·입금·출석은 바꾸지 못한다(DEC-68). 권한 뒤, 신청 행 잠금 앞이다(공개 경로와 같은 차례).
  await assertEventOpen(tx, first.eventId)
  await lockRegistration(tx, first.id)
  const row = await rowOf(tx, actor, registrationId)
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 신청 관리 권한으로 잠근 살아 있는 신청. 취소한 신청은 404다.
export async function lockedLiveRegistration(tx: Tx, actor: Actor, registrationId: string) {
  return liveOrNotFound(await lockedRegistration(tx, actor, registrationId, assertManage))
}

// 입금 확인도 취소한 신청은 없는 것과 같아 같은 응답(404)이다. 권한 확인만 다르다.
export const liveOrNotFound = <T extends { cancelledAt: Date | null; name: string | null }>(
  row: T,
) => {
  const live = liveOf(row)
  if (!live) throw new ApiError('NOT_FOUND')
  return live
}
