import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
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

// 관리 권한을 보고 신청 행을 잠근 뒤 다시 읽는다. 스스로 취소와 같은 순서라 취소·출석이 겹쳐도 하나만 된다.
// 다른 학생회 신청은 권한을 묻기 전에 404이고, 같은 학생회 신청은 권한이 없으면 403이다.
export async function lockedLiveRegistration(tx: Tx, actor: Actor, registrationId: string) {
  const first = await rowOf(tx, actor, registrationId)
  if (!first) throw new ApiError('NOT_FOUND')
  await assertManage(tx, actor, { id: first.eventId, ownerId: first.ownerId })
  await lockRegistration(tx, first.id)
  const row = liveOf(await rowOf(tx, actor, registrationId))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}
