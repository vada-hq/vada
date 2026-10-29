import { and, asc, count, eq, gt, isNotNull, isNull, type SQL } from 'drizzle-orm'
import {
  APPLICANT_LIST_LIMIT,
  koreanOf,
  type Applicant,
  type ApplicantDeposit,
  type ApplicantFilter,
  type ApplicantsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, deposit, record, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { refundPendingFacts, refundPendingSql } from '../deposits/refund-pending.js'
import { listedSql } from './listed.js'
import { recordApplicantAccess } from './access-log.js'
import {
  applicantActionsOf,
  applicantFactsFrom,
  attendanceFactsFrom,
  decideOnEvent,
  eventFactsOf,
} from './policy.js'
import { formRowOf } from './queries.js'

// 같은 행사(양식 여럿 포함)에서 취소하지 않은 신청이 둘 이상인 학번. 같은 양식 안은 신청에서 막으므로(DEC-107) 다른 양식 사이를 드러낸다(DEC-26·DEC-67)
export async function duplicateStudentIds(tx: Tx, eventId: string) {
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

// 취소하지 않은 입금 기록이 있고 환불 전이다(신청이 취소됐으면 환불 대기).
const unrefunded = and(isNotNull(deposit.id), isNull(deposit.refundedAt))

export function depositOf(row: {
  depositId: string | null
  depositAmount: string | null
  refundedAt: Date | null
  cancelledAt: Date | null
}): ApplicantDeposit {
  if (row.depositId === null) return { status: 'none', amount: null }
  const amount = Number(row.depositAmount)
  if (row.refundedAt !== null) return { status: 'refunded', amount }
  const pending = refundPendingFacts({
    registrationCancelledAt: row.cancelledAt,
    hasDeposit: true,
    refundedAt: row.refundedAt,
  })
  return { status: pending ? 'refund_pending' : 'confirmed', amount }
}

// 거르기: 입금 확인한 신청, 환불 대기 신청
function filterOf(filter: ApplicantFilter | undefined): SQL | undefined {
  if (filter === 'deposited') return and(unrefunded, isNull(registration.cancelledAt))
  if (filter === 'refund_pending') return refundPendingSql
  return undefined
}

// 신청 순(번호가 시각 순서다, uuidv7)으로 한 개 더 읽어 넘쳤는지 안다.
// 취소한 신청은 환불 대기(이름이 남고 환불 전 입금이 있다)만 남긴다. 환불한 신청은 이름이 비어 빠진다.
function applicantRowsOf(tx: Tx, formId: string, filter: ApplicantFilter | undefined) {
  return (
    tx
      .select({
        id: registration.id,
        name: registration.name,
        studentId: registration.studentId,
        phone: registration.phone,
        appliedFee: registration.appliedFee,
        appliedAt: record.createdAt,
        attendanceResult: attendance.result,
        cancelledAt: registration.cancelledAt,
        depositId: deposit.id,
        depositAmount: deposit.amount,
        refundedAt: deposit.refundedAt,
      })
      .from(registration)
      .innerJoin(record, eq(record.id, registration.id))
      .leftJoin(
        attendance,
        and(eq(attendance.registrationId, registration.id), isNull(attendance.cancelledAt)),
      )
      .leftJoin(
        deposit,
        and(eq(deposit.registrationId, registration.id), isNull(deposit.cancelledAt)),
      )
      .where(and(eq(registration.formId, formId), listedSql, filterOf(filter)))
      // 번호가 시각 순서다(uuidv7).
      .orderBy(asc(registration.id))
      .limit(APPLICANT_LIST_LIMIT + 1)
  )
}

// 신청자 목록(신청 순). 열람 권한자만 받고(없으면 403, 기록도 없다), 받을 때마다 열람 기록이 같은 거래에서 한 줄 남는다.
// 기한이 지나 비운 신청(이름이 비었다)과, 환불 대기가 아닌 취소한 신청은 없다. 학생회 경계는 양식의 행사로 건다(다른 학생회 양식은 404).
export async function applicantsOf(
  tx: Tx,
  actor: Actor,
  target: { formId: string; ip: string; filter?: ApplicantFilter | undefined },
): Promise<ApplicantsResponse> {
  const form = await formRowOf(tx, actor, target.formId)
  const eventFacts = await eventFactsOf(tx, actor, form)
  const code = decideOnEvent(actor, eventFacts, 'form.view_applicants')
  if (code) throw new ApiError(code)
  const rows = await applicantRowsOf(tx, form.id, target.filter)
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
    ...attendanceFactsFrom(row.attendanceResult),
    appliedAt: koreanOf(row.appliedAt),
    cancelled: row.cancelledAt !== null,
    deposit: depositOf(row),
    actions: applicantActionsOf(
      actor,
      applicantFactsFrom(eventFacts, {
        name: row.name,
        appliedFee: row.appliedFee,
        cancelledAt: row.cancelledAt,
        ...attendanceFactsFrom(row.attendanceResult),
        deposit:
          row.depositId === null
            ? null
            : { id: row.depositId, amount: Number(row.depositAmount), refundedAt: row.refundedAt },
      }),
    ),
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
