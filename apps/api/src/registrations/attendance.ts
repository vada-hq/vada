import { and, eq, isNull } from 'drizzle-orm'
import type { CheckInResult } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, registration, registrationForm, registrationLink } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { assertEventOpen } from '../events/completion.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { recordApplicantAccess } from './access-log.js'
import { assertManage } from './permission-context.js'
import { lockRegistration } from './registration-lock.js'
import { lockedLiveRegistration } from './staff-registration.js'

type Method = 'qr' | 'manual'
type Target = { registrationId: string; formId: string; name: string; studentId: string | null }

async function activeAttendanceId(tx: Tx, registrationId: string) {
  const [row] = await tx
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(eq(attendance.registrationId, registrationId), isNull(attendance.cancelledAt)))
  return row?.id ?? null
}

// 출석을 남기고 스캔한 사람에게 보일 이름과 학번을 돌려준다. 이미 출석이면 새로 만들지 않고 already다(오류가 아니다).
// 이름과 학번을 응답에 담으므로 열람 기록(check_in)을 같은 거래에서, 응답을 만들기 전에 남긴다.
// 신청 행을 잠근 거래 안에서 부르므로 같은 QR 두 번도 하나만 만들고(부분 유일 인덱스는 마지막 방어선) 나머지는 already다.
async function confirm(
  tx: Tx,
  actor: Actor,
  target: Target,
  how: { method: Method; ip: string },
): Promise<CheckInResult> {
  const already = (await activeAttendanceId(tx, target.registrationId)) !== null
  if (!already)
    await createRecord(tx, {
      kind: 'attendance',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { registrationId: target.registrationId, confirmedAt: clockNow, method: how.method },
    })
  await recordApplicantAccess(tx, {
    actor,
    formId: target.formId,
    registrationId: target.registrationId,
    action: 'check_in',
    ip: how.ip,
  })
  return {
    registrationId: target.registrationId,
    name: target.name,
    studentId: target.studentId,
    already,
  }
}

// 그 행사의 양식에 이어진, 취소하지 않고 비우지 않은 신청 하나(토큰 해시로)
async function linkedRegistration(tx: Tx, eventId: string, tokenHash: string) {
  const [row] = await tx
    .select({
      registrationId: registration.id,
      formId: registration.formId,
      name: registration.name,
      studentId: registration.studentId,
    })
    .from(registrationLink)
    .innerJoin(registration, eq(registration.id, registrationLink.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(
      and(
        eq(registrationLink.tokenHash, tokenHash),
        eq(registrationForm.eventId, eventId),
        isNull(registration.cancelledAt),
      ),
    )
  return row?.name ? { ...row, name: row.name } : null
}

// QR로 출석. 그 행사의 양식이 아니거나 취소·비운 신청이면 가르지 않고 404다. 날짜 제한은 두지 않는다.
export async function checkInByQr(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; tokenHash: string; ip: string },
): Promise<CheckInResult> {
  const event = await eventRowOf(tx, actor, target.eventId)
  await assertManage(tx, actor, { id: event.id, ownerId: event.ownerId })
  await assertEventOpen(tx, event.id)
  const first = await linkedRegistration(tx, event.id, target.tokenHash)
  if (!first) throw new ApiError('NOT_FOUND')
  await lockRegistration(tx, first.registrationId)
  // 잠금을 기다리는 사이 스스로 취소가 끝났을 수 있어(링크가 지워진다) 잠근 뒤에 다시 읽는다.
  const row = await linkedRegistration(tx, event.id, target.tokenHash)
  if (!row) throw new ApiError('NOT_FOUND')
  return confirm(tx, actor, row, { method: 'qr', ip: target.ip })
}

// 이름으로 찾아 출석(QR을 못 꺼낼 때)
export async function checkInManually(
  tx: Tx,
  actor: Actor,
  target: { registrationId: string; ip: string },
): Promise<CheckInResult> {
  const row = await lockedLiveRegistration(tx, actor, target.registrationId)
  return confirm(
    tx,
    actor,
    { registrationId: row.id, formId: row.formId, name: row.name, studentId: row.studentId },
    { method: 'manual', ip: target.ip },
  )
}

// 출석 취소. 출석이 없으면 409다. 취소하면 같은 신청이 다시 출석할 수 있다(부분 유일 인덱스).
export async function cancelAttendance(tx: Tx, actor: Actor, registrationId: string) {
  const row = await lockedLiveRegistration(tx, actor, registrationId)
  const id = await activeAttendanceId(tx, row.id)
  if (!id) throw new ApiError('NOT_CHECKED_IN')
  await updateRecord(tx, {
    kind: 'attendance',
    id,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
