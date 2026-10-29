import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { koreanOf, type EventApplicant } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, deposit, record, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { refundPendingSql } from '../deposits/refund-pending.js'
import { depositOf } from './applicants.js'
import { listedSql } from './listed.js'
import {
  applicantActionsOf,
  applicantFactsFrom,
  attendanceFactsFrom,
  type EventFacts,
} from './policy.js'

const duplicateSql = (duplicates: Set<string | null>) => {
  const ids = [...duplicates].filter((id): id is string => id !== null)
  return ids.length ? sql`coalesce(${inArray(registration.studentId, ids)}, false)` : sql`false`
}
type Scope = {
  eventId: string
  duplicates: Set<string | null>
  now: Date
}
const attentionSql = ({ duplicates, now }: Scope) =>
  sql<boolean>`(${or(
    duplicateSql(duplicates),
    refundPendingSql,
    and(
      gt(registration.appliedFee, '0'),
      lte(registrationForm.closesAt, now),
      isNull(deposit.id),
      isNull(registration.cancelledAt),
    ),
  )})`
export function eventApplicantRows(tx: Tx, scope: Scope) {
  return tx
    .select({
      id: registration.id,
      name: registration.name,
      studentId: registration.studentId,
      phone: registration.phone,
      appliedFee: registration.appliedFee,
      appliedAt: record.createdAt,
      formId: registrationForm.id,
      formTitle: registrationForm.name,
      payerFee: registrationForm.payerFee,
      nonPayerFee: registrationForm.nonPayerFee,
      attendanceResult: attendance.result,
      cancelledAt: registration.cancelledAt,
      depositId: deposit.id,
      depositAmount: deposit.amount,
      refundedAt: deposit.refundedAt,
      needsAttention: attentionSql(scope).as('needs_attention'),
    })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(record, eq(record.id, registration.id))
    .leftJoin(
      attendance,
      and(eq(attendance.registrationId, registration.id), isNull(attendance.cancelledAt)),
    )
    .leftJoin(
      deposit,
      and(eq(deposit.registrationId, registration.id), isNull(deposit.cancelledAt)),
    )
    .where(and(eq(registrationForm.eventId, scope.eventId), listedSql))
    .orderBy(asc(registration.id))
}
type Row = Awaited<ReturnType<typeof eventApplicantRows>>[number]
export function eventApplicantOf(
  row: Row,
  actor: Actor,
  facts: EventFacts,
  duplicates: Set<string | null>,
): Omit<EventApplicant, 'answers'> {
  const duplicate = row.studentId !== null && duplicates.has(row.studentId)
  return {
    id: row.id,
    name: row.name!,
    studentId: row.studentId,
    phone: row.phone,
    appliedFee: Number(row.appliedFee),
    payer:
      row.payerFee !== row.nonPayerFee ? Number(row.appliedFee) === Number(row.payerFee) : null,
    duplicateStudentId: duplicate,
    needsAttention: row.needsAttention,
    ...attendanceFactsFrom(row.attendanceResult),
    appliedAt: koreanOf(row.appliedAt),
    cancelled: row.cancelledAt !== null,
    deposit: depositOf(row),
    formId: row.formId,
    formTitle: row.formTitle,
    affiliation: null,
    actions: applicantActionsOf(
      actor,
      applicantFactsFrom(facts, {
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
  }
}
