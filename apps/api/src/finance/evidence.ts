import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { members, paymentDocuments, payments } from '../db/schema.ts'
import { dayOf, joinParts, orNote, statusOf, won } from './labels.ts'
import { itemRows, requestRow, totalApproved } from './requests.ts'

// 결제·증빙 정리(FIN-EVID-01).
//
// **승인 금액과 실결제 합계가 따로 온다** — 둘이 다를 수 있고, 그 차이가 이 단계에서
// 드러나는 것이 이 화면의 일이다. 그래서 두 수를 잇는 문구도 서버가 만든다:
// 무엇을 무엇에 견주는지가 곧 재정의 표기다.
//
// **묶음 하나가 결제 하나다.** 딸린 품목과 증빙을 따로 조회하지 않는 까닭은 그것이
// 그 결제의 일부이기 때문이다.

export interface PaymentEvidenceSummary {
  eventName: string
  code: string
  status: string
  statusTone: string
  title: string
  requesterNote: string
  approvedAmountNote: string
  paidAmountNote: string
  completeBlockedNote: string
}

export async function paymentEvidenceSummary(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PaymentEvidenceSummary | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  const items = await itemRows(db, orgId, row.id)
  const paid = await paymentRows(db, orgId, row.id)
  const documents = await documentRows(
    db,
    orgId,
    paid.map((one) => one.id),
  )
  const status = statusOf(row.stage, row.supplementRequestedAt)

  return {
    eventName: orNote(row.eventName, '상시 지출'),
    code: orNote(row.code, '번호 미정'),
    status: status.label,
    statusTone: status.tone,
    title: row.title,
    requesterNote: orNote(joinParts([row.departmentName, row.requesterName]), '요청자 미정'),
    approvedAmountNote: won(totalApproved(items)),
    paidAmountNote: won(paid.reduce((sum, one) => sum + one.paidAmount, 0)),
    completeBlockedNote: blockedNote(row.stage, documents),
  }
}

/**
 * 처리를 끝낼 수 없으면 그 이유. **끝낼 수 있으면 빈 값이다.**
 *
 * 무엇이 '증빙이 다 모인 것'인지는 조직의 재정 규칙이라 화면이 셀 수 없다 —
 * 붙어야 하는 서류의 자리를 서버가 만들어 두고, 붙으면 `registeredAt`이 찍힌다.
 */
function blockedNote(stage: string, documents: readonly DocumentRow[]): string {
  // 이미 끝난 요청을 또 끝낼 수 없다(`finance.purchaseRequest.completeEvidence`).
  if (stage === 'settled') return '이미 처리가 완료된 요청입니다.'
  const missing = documents.filter((one) => one.registeredAt === null).length
  return missing === 0 ? '' : `증빙 서류 ${missing}건이 아직 등록되지 않았습니다.`
}

interface PaymentRow {
  id: string
  vendor: string
  paidOn: Date | null
  method: string | null
  paidAmount: number
  payerName: string | null
}

async function paymentRows(db: Db, orgId: string, requestId: string): Promise<PaymentRow[]> {
  const rows = await db
    .select({
      id: payments.id,
      vendor: payments.vendor,
      paidOn: payments.paidOn,
      method: payments.method,
      paidAmount: payments.paidAmount,
      payerName: members.name,
    })
    .from(payments)
    .leftJoin(members, and(eq(payments.payerMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(payments.orgId, orgId), eq(payments.requestId, requestId)))
    .orderBy(asc(payments.paidOn), asc(payments.id))
  return rows as PaymentRow[]
}

interface DocumentRow {
  id: string
  paymentId: string
  label: string
  registeredAt: Date | null
}

async function documentRows(
  db: Db,
  orgId: string,
  paymentIds: readonly string[],
): Promise<DocumentRow[]> {
  if (paymentIds.length === 0) return []
  const rows = await db
    .select({
      id: paymentDocuments.id,
      paymentId: paymentDocuments.paymentId,
      label: paymentDocuments.label,
      registeredAt: paymentDocuments.registeredAt,
    })
    .from(paymentDocuments)
    .where(
      and(
        eq(paymentDocuments.orgId, orgId),
        inArray(paymentDocuments.paymentId, [...paymentIds]),
      ),
    )
    // 서버가 자리를 만들어 두는 줄이라 만든 차례가 곧 그리는 차례다.
    .orderBy(asc(paymentDocuments.id))
  return rows as DocumentRow[]
}

export interface PaymentEvidence {
  id: string
  vendor: string
  paidNote: string
  amountNote: string
  gapNote?: string
  items: Array<{ id: string; name: string }>
  documents: Array<{ id: string; label: string; status: string; statusTone: string }>
}

export async function paymentEvidences(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PaymentEvidence[] | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  const paid = await paymentRows(db, orgId, row.id)
  const items = await itemRows(db, orgId, row.id)
  const documents = await documentRows(
    db,
    orgId,
    paid.map((one) => one.id),
  )

  return paid.map((payment) => {
    const mine = items.filter((item) => item.paymentId === payment.id)
    const approved = mine.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0)
    const paidOn = dayOf(payment.paidOn)
    const gap = payment.paidAmount - approved
    return {
      id: payment.id,
      vendor: payment.vendor,
      paidNote: orNote(
        joinParts([
          paidOn === null ? null : `결제일 ${paidOn}`,
          payment.payerName === null ? null : `결제자 ${payment.payerName}`,
          payment.method,
        ]),
        '결제 정보 미기재',
      ),
      amountNote: `승인 ${won(approved)} → 실결제 ${won(payment.paidAmount)}`,
      // **같으면 오지 않는다**(명세가 선택으로 적었다). 어떻게 다른지는 서버가 센다.
      ...(gap === 0
        ? {}
        : {
            gapNote: `실결제액이 승인액보다 ${won(Math.abs(gap))} ${gap > 0 ? '많음' : '적음'}`,
          }),
      items: mine.map((item) => ({ id: item.id, name: item.name })),
      documents: documents
        .filter((one) => one.paymentId === payment.id)
        .map((one) => ({
          id: one.id,
          label: one.label,
          // 화면이 그린 딱지가 둘이다 — 붙었는가 안 붙었는가.
          status: one.registeredAt === null ? '누락' : '등록 완료',
          statusTone: one.registeredAt === null ? 'red' : 'green',
        })),
    }
  })
}
