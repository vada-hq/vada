import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { paymentDocuments, payments, purchaseRequests } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { objectOf, readWord } from './body.ts'
import { requestOf } from './rows.ts'

// 결제·증빙 정리 끝내기(FIN-EVID-01의 `finance.purchaseRequest.completeEvidence`).
//
// **끝낼 수 있는지는 서버가 정한다.** 무엇이 '증빙이 다 모인 것'인지는 조직의 재정 규칙이라 화면이
// 셀 수 없다 — 읽는 자리(`finance/evidence.ts`의 blockedNote)가 붙지 않은 서류의 수로 그 까닭을 글로
// 주고, 여기서는 **같은 셈**으로 막는다. 화면이 먼저 막지만 화면을 거치지 않은 요청도 같은 벽을 만난다.

/**
 * 처리를 끝낸다. 붙지 않은 서류가 있으면 422, 이미 끝났으면 409(계약의 repeat: conflict), 아직
 * 결제·증빙 단계가 아니면 422다 — 검토 중인 요청을 처리 완료로 건너뛸 수는 없다.
 */
export async function completeEvidence(
  db: Db,
  orgId: string,
  body: unknown,
  now: Date,
): Promise<Record<string, never>> {
  const asked = objectOf(body, '처리 완료')
  const row = await requestOf(db, orgId, readWord(asked, 'requestId', '요청') ?? '')
  if (row === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  if (row.stage === 'settled') throw new AlreadyExists('이미 처리가 완료된 요청입니다.')
  if (row.stage !== 'proof') throw new Blocked('결제·증빙 단계의 요청만 처리를 끝낼 수 있습니다')

  const [missing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentDocuments)
    .innerJoin(payments, and(eq(paymentDocuments.paymentId, payments.id), eq(payments.orgId, orgId)))
    .where(
      and(
        eq(paymentDocuments.orgId, orgId),
        eq(payments.requestId, row.id),
        isNull(paymentDocuments.registeredAt),
      ),
    )
  const left = missing?.count ?? 0
  if (left > 0) throw new Blocked(`증빙 서류 ${left}건이 아직 등록되지 않았습니다.`)

  await db
    .update(purchaseRequests)
    .set({ stage: 'settled', evidenceCompletedAt: now, updatedAt: now })
    .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, row.id)))
  return {}
}
