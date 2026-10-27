import { and, eq, isNull } from 'drizzle-orm'
import type { CheckInResult } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, registration, registrationForm, registrationLink } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { recordApplicantAccess } from './access-log.js'
import { assertEventAction } from './policy.js'
import { applicantChangeOf, lockedLiveRegistration } from './staff-registration.js'

type Method = 'qr' | 'manual'
type Target = {
  registrationId: string
  formId: string
  name: string
  studentId: string | null
  appliedFee: number | string
}

async function activeAttendance(tx: Tx, registrationId: string) {
  const [row] = await tx
    .select({ id: attendance.id, confirmedAt: attendance.confirmedAt })
    .from(attendance)
    .where(and(eq(attendance.registrationId, registrationId), isNull(attendance.cancelledAt)))
  return row ?? null
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
  const existing = await activeAttendance(tx, target.registrationId)
  const already = existing !== null
  const attendanceId =
    existing?.id ??
    (await createRecord(tx, {
      kind: 'attendance',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { registrationId: target.registrationId, confirmedAt: clockNow, method: how.method },
    }))
  await recordApplicantAccess(tx, {
    actor,
    formId: target.formId,
    registrationId: target.registrationId,
    action: 'check_in',
    ip: how.ip,
  })
  return {
    registrationId: target.registrationId,
    attendanceId,
    name: target.name,
    studentId: target.studentId,
    appliedFee: Number(target.appliedFee),
    already,
    ...(existing ? { checkedInAt: existing.confirmedAt.toISOString() } : {}),
    applicant: await applicantChangeOf(tx, actor, target.registrationId),
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
      appliedFee: registration.appliedFee,
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
  // 출석은 양식의 마감·멈춤을 보지 않아(마감 뒤 행사 날에 한다) 행사 단위 판정이다.
  await assertEventAction(tx, actor, 'form.check_in', {
    eventId: event.id,
    eventOwnerId: event.ownerId,
  })
  const first = await linkedRegistration(tx, event.id, target.tokenHash)
  if (!first) throw new ApiError('NOT_FOUND')
  // 신청 행을 잠그고 수동 출석과 같은 판정(권한, 완료, 살아 있음)을 지난다.
  await lockedLiveRegistration(tx, actor, first.registrationId, 'registration.check_in')
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
  const row = await lockedLiveRegistration(
    tx,
    actor,
    target.registrationId,
    'registration.check_in',
  )
  return confirm(
    tx,
    actor,
    {
      registrationId: row.id,
      formId: row.formId,
      name: row.name,
      studentId: row.studentId,
      appliedFee: row.appliedFee,
    },
    { method: 'manual', ip: target.ip },
  )
}

// 출석 취소. 출석이 없으면 정책이 409(NOT_CHECKED_IN)로 막는다. 취소하면 같은 신청이 다시 출석할 수 있다(부분 유일 인덱스).
// attendanceId([입장 안 함])가 있으면 신청 행을 잠근 뒤 그 출석이 지금 출석일 때만 취소한다. 그사이 다른 운영진이
// 취소·재출석했으면(출석이 없어진 경우 포함) 남이 만든 출석을 건드리지 않고 409 ATTENDANCE_CHANGED다.
export async function cancelAttendance(
  tx: Tx,
  actor: Actor,
  target: { registrationId: string; attendanceId?: string | undefined },
) {
  const row = await lockedLiveRegistration(
    tx,
    actor,
    target.registrationId,
    'registration.cancel_check_in',
  ).catch((error: unknown) => {
    // NOT_CHECKED_IN은 판정의 마지막(상태) 코드라, 권한·완료·살아 있음은 이미 지났다.
    if (target.attendanceId && error instanceof ApiError && error.code === 'NOT_CHECKED_IN')
      throw new ApiError('ATTENDANCE_CHANGED')
    throw error
  })
  // 출석이 있음은 정책이 보장했다.
  const { id } = (await activeAttendance(tx, row.id))!
  if (target.attendanceId && target.attendanceId !== id) throw new ApiError('ATTENDANCE_CHANGED')
  await updateRecord(tx, {
    kind: 'attendance',
    id,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
