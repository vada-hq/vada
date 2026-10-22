import { and, asc, count, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import {
  APPLICANT_LIST_LIMIT,
  koreanOf,
  type Applicant,
  type ApplicantsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { attendance, record, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { recordApplicantAccess } from './access-log.js'
import { registrationContextOf } from './permission-context.js'
import { formRowOf } from './queries.js'

// 같은 행사(양식 여럿 포함)에서 취소하지 않은 신청이 둘 이상인 학번(DEC-26: 막지 않고 드러낸다)
async function duplicateStudentIds(tx: Tx, eventId: string) {
  const rows = await tx
    .select({ studentId: registration.studentId })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(
      and(
        eq(registrationForm.eventId, eventId),
        isNull(registration.cancelledAt),
        isNotNull(registration.studentId),
      ),
    )
    .groupBy(registration.studentId)
    .having(gt(count(), 1))
  return new Set(rows.map(row => row.studentId))
}

// 신청 순(번호가 시각 순서다, uuidv7)으로 한 개 더 읽어 넘쳤는지 안다.
function applicantRowsOf(tx: Tx, formId: string) {
  return (
    tx
      .select({
        id: registration.id,
        name: registration.name,
        studentId: registration.studentId,
        phone: registration.phone,
        appliedFee: registration.appliedFee,
        appliedAt: record.createdAt,
        attendanceId: attendance.id,
      })
      .from(registration)
      .innerJoin(record, eq(record.id, registration.id))
      .leftJoin(
        attendance,
        and(eq(attendance.registrationId, registration.id), isNull(attendance.cancelledAt)),
      )
      .where(
        and(
          eq(registration.formId, formId),
          isNull(registration.cancelledAt),
          isNotNull(registration.name),
        ),
      )
      // 번호가 시각 순서다(uuidv7).
      .orderBy(asc(registration.id))
      .limit(APPLICANT_LIST_LIMIT + 1)
  )
}

// 신청자 목록(신청 순). 열람 권한자만 받고(없으면 403, 기록도 없다), 받을 때마다 열람 기록이 같은 거래에서 한 줄 남는다.
// 기한이 지나 비운 신청(이름이 비었다)과 취소한 신청은 없다. 학생회 경계는 양식의 행사로 건다(다른 학생회 양식은 404).
export async function applicantsOf(
  tx: Tx,
  actor: Actor,
  target: { formId: string; ip: string },
): Promise<ApplicantsResponse> {
  const form = await formRowOf(tx, actor, target.formId)
  const context = await registrationContextOf(tx, actor, {
    id: form.eventId,
    ownerId: form.eventOwnerId,
  })
  if (!can(actor, 'registration.view_applicants', context)) throw new ApiError('FORBIDDEN')
  const rows = await applicantRowsOf(tx, form.id)
  const duplicates = await duplicateStudentIds(tx, form.eventId)
  const splitFees = form.payerFee !== form.nonPayerFee
  const applicants = rows.slice(0, APPLICANT_LIST_LIMIT).map((row): Applicant => ({
    id: row.id,
    name: row.name!,
    studentId: row.studentId,
    phone: row.phone,
    appliedFee: Number(row.appliedFee),
    payer: splitFees ? Number(row.appliedFee) === Number(form.payerFee) : null,
    duplicateStudentId: row.studentId !== null && duplicates.has(row.studentId),
    attended: row.attendanceId !== null,
    appliedAt: koreanOf(row.appliedAt),
  }))
  // 응답을 만들기 전에 남긴다: 기록을 못 쓰면 던져서 목록이 나가지 않는다.
  await recordApplicantAccess(tx, {
    actor,
    formId: form.id,
    registrationId: null,
    action: 'list',
    ip: target.ip,
  })
  return { applicants, truncated: rows.length > APPLICANT_LIST_LIMIT }
}
