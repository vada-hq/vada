import { and, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { EventFees, PaymentBasis } from '@vada/contracts'
import { registrationForms, registrations } from '../db/schema.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
type FormFee = { fee: number; memberFee: number | null }
type EntryFee = { duesMember: boolean | null; paidAmount: number | null }

// 참가비를 정한 근거. 납부자 참가비가 없으면 모두 같은 참가비다.
export function basisOf(form: FormFee, entry: EntryFee): PaymentBasis {
  if (form.memberFee === null) return 'flat'
  return entry.duesMember ? 'member' : 'nonmember'
}
// 낼 돈. 입금을 확인했으면 확인 금액이고, 아니면 지금 설정과 납부 구분으로 계산한다.
export function owedOf(form: FormFee, entry: EntryFee) {
  if (entry.paidAmount !== null) return entry.paidAmount
  return basisOf(form, entry) === 'member' ? form.memberFee! : form.fee
}

// 낼 돈 식: 납부자 참가비가 있고 납부자면 납부자 참가비, 아니면 참가비(owedOf와 같다). 운영 현황(M6)의 입금 확인 전도 쓴다.
export const owedSql = sql`CASE WHEN ${registrationForms.memberFee} IS NOT NULL AND ${registrations.duesMember}
  THEN ${registrationForms.memberFee} ELSE ${registrationForms.fee} END`

// 행사의 참가비 숫자(받은 참가비·입금 확인 수·입금 전). 참가 신청이 없거나, 참가비를 받지 않고 입금 확인도 없으면 null이다.
// 받은 참가비는 취소했거나 정보를 지운 신청의 확인 금액도 센다. 입금 전은 정보를 지우지 않은 신청만 센다(참가자 탭의 "입금 전").
// lastPaidAt은 마지막으로 입금을 확인한 때이고, 정산이 참가비 수입의 받은 날로 쓴다.
export async function eventFeesOf(db: Reader, organizationId: string, eventId: string): Promise<(EventFees & { lastPaidAt: Date | null }) | null> {
  const owed = owedSql
  const [row] = await db.select({
    fee: registrationForms.fee, memberFee: registrationForms.memberFee,
    received: sql<string>`coalesce(sum(${registrations.paidAmount}), 0)`,
    count: sql<number>`count(${registrations.paidAt})::int`,
    // 신청자가 없으면 LEFT JOIN이 빈 줄 하나를 만든다. 신청 ID가 있는 줄만 센다.
    unpaid: sql<number>`(count(*) filter (where ${registrations.id} is not null and ${registrations.purgedAt} is null
      and ${registrations.paidAt} is null and ${owed} > 0))::int`,
    lastPaidAt: sql<Date | null>`max(${registrations.paidAt})`.mapWith(registrations.paidAt),
  }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
    .groupBy(registrationForms.id)
  if (!row || (row.fee === 0 && row.memberFee === null && row.count === 0)) return null
  return { received: Number(row.received), count: row.count, unpaid: row.unpaid, lastPaidAt: row.lastPaidAt }
}
