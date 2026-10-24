import { and, eq } from 'drizzle-orm'
import type { ApplicantAction } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { event, record, registration, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { lockEventsShared } from '../policy/locks.js'
import { registrationContextOf } from './permission-context.js'
import { applicantFactsOf, decideApplicant, mayApplicant } from './policy.js'
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

// 권한을 보고 행사 행과 신청 행을 잠근 뒤 다시 읽어 같은 판정(registrations/policy.ts)으로 거른다.
// 다른 학생회 신청은 권한을 묻기 전에 404이고, 같은 학생회 신청은 권한이 없으면 잠그기 전에 403이다.
// 완료(409)는 신청 행 잠금 앞이다(공개 경로와 같은 차례). 스스로 취소와 같은 신청 행 잠금 뒤 다시 읽기라 겹쳐도 하나만 된다.
// 쓰기가 이어서 쓸 신청 행과 취소하지 않은 입금 기록을 돌려준다.
export async function lockedRegistration(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  action: ApplicantAction,
) {
  const first = await rowOf(tx, actor, registrationId)
  if (!first) throw new ApiError('NOT_FOUND')
  const context = await registrationContextOf(tx, actor, {
    id: first.eventId,
    ownerId: first.ownerId,
  })
  // 권한 없는 사람이 행 잠금을 잡지 않게 잠금 앞에서 한 번 본다. 같은 판정이 decideApplicant 첫 줄에도 있다.
  if (!mayApplicant(actor, context, action)) throw new ApiError('FORBIDDEN')
  await lockEventsShared(tx, [first.eventId])
  await lockRegistration(tx, first.id)
  const row = await rowOf(tx, actor, registrationId)
  if (!row) throw new ApiError('NOT_FOUND')
  const facts = await applicantFactsOf(tx, actor, row)
  const code = decideApplicant(actor, facts, action)
  if (code) throw new ApiError(code)
  return { ...row, deposit: facts.deposit }
}

// 살아 있는 신청에 하는 동작(출석, 신청 취소, 입금 확인)용. decideApplicant가 살아 있음(이름이 있음)을 보장했다.
export async function lockedLiveRegistration(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  action: ApplicantAction,
) {
  const row = await lockedRegistration(tx, actor, registrationId, action)
  return { ...row, name: row.name! }
}
