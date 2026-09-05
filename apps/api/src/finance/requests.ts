import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  payments,
  purchaseRequestItems,
  purchaseRequests,
} from '../db/schema.ts'
import type { PurchaseStage } from './labels.ts'
import { requestedAmount } from './labels.ts'

// 구매 요청 한 건과 그 금액.
//
// **화면 넷이 같은 줄을 본다.** 검토·구매·증빙·내 요청이 전부 `purchase_requests`의
// 한 줄에서 시작하므로, 그 줄을 읽는 일과 금액을 세는 일을 여기 한 곳에 둔다 —
// 화면마다 따로 세면 같은 요청의 금액이 화면마다 갈린다.

const ROW = {
  id: purchaseRequests.id,
  eventId: purchaseRequests.eventId,
  code: purchaseRequests.code,
  title: purchaseRequests.title,
  purpose: purchaseRequests.purpose,
  stage: purchaseRequests.stage,
  neededOn: purchaseRequests.neededOn,
  submittedAt: purchaseRequests.submittedAt,
  supplementRequestedAt: purchaseRequests.supplementRequestedAt,
  evidenceCompletedAt: purchaseRequests.evidenceCompletedAt,
  eventName: events.title,
  departmentName: departments.name,
  requesterName: members.name,
}

export interface RequestRow {
  id: string
  eventId: string | null
  code: string | null
  title: string
  purpose: string | null
  stage: PurchaseStage
  neededOn: Date | null
  submittedAt: Date | null
  supplementRequestedAt: Date | null
  evidenceCompletedAt: Date | null
  eventName: string | null
  departmentName: string | null
  requesterName: string | null
}

/**
 * 그 요청 한 건. 없으면 null이다.
 *
 * **이어 붙인 표도 자기 조직을 확인한다.** id만 이으면 남의 조직의 부서 이름이
 * 우리 요청에 그려진다(2026-08-31 교차검토가 행사에서 같은 것을 찾았다).
 */
export async function requestRow(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<RequestRow | null> {
  if (requestId === '') return null
  const rows = await db
    .select(ROW)
    .from(purchaseRequests)
    .leftJoin(events, and(eq(purchaseRequests.eventId, events.id), eq(events.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(purchaseRequests.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(
      members,
      and(eq(purchaseRequests.requesterMemberId, members.id), eq(members.orgId, orgId)),
    )
    .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, requestId)))
    .limit(1)
  return (rows[0] as RequestRow | undefined) ?? null
}

export interface ItemRow {
  id: string
  name: string
  category: string | null
  purchaseType: string | null
  budgetItemName: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  reviewResult: 'approved' | 'supplement' | 'rejected' | null
  approvedAmount: number | null
  /** 보완이면 그 사유. 재정부가 적고 요청자가 읽는다. */
  reviewNote: string | null
  orderId: string | null
  expectedDeliveryOn: Date | null
  deliveredAt: Date | null
  paymentId: string | null
  sortOrder: number
}

/** 그 요청의 품목들. **한 줄이 요청의 처음부터 끝까지 따라간다.** */
export async function itemRows(db: Db, orgId: string, requestId: string): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: purchaseRequestItems.id,
      name: purchaseRequestItems.name,
      category: purchaseRequestItems.category,
      purchaseType: purchaseRequestItems.purchaseType,
      budgetItemName: budgetItems.name,
      quantity: purchaseRequestItems.quantity,
      unit: purchaseRequestItems.unit,
      unitPrice: purchaseRequestItems.unitPrice,
      reviewResult: purchaseRequestItems.reviewResult,
      approvedAmount: purchaseRequestItems.approvedAmount,
      reviewNote: purchaseRequestItems.reviewNote,
      orderId: purchaseRequestItems.orderId,
      expectedDeliveryOn: purchaseRequestItems.expectedDeliveryOn,
      deliveredAt: purchaseRequestItems.deliveredAt,
      paymentId: purchaseRequestItems.paymentId,
      sortOrder: purchaseRequestItems.sortOrder,
    })
    .from(purchaseRequestItems)
    .leftJoin(
      budgetItems,
      and(eq(purchaseRequestItems.budgetItemId, budgetItems.id), eq(budgetItems.orgId, orgId)),
    )
    .where(
      and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.requestId, requestId)),
    )
    .orderBy(purchaseRequestItems.sortOrder, purchaseRequestItems.id)
  return rows as ItemRow[]
}

/** 요청 전체의 요청액. 적을 때의 값(수량 × 단가)을 더한 것이다. */
export function totalRequested(items: readonly ItemRow[]): number {
  return items.reduce((sum, item) => sum + (requestedAmount(item.quantity, item.unitPrice) ?? 0), 0)
}

/** 검토에서 승인된 금액. **아직 판정하지 않은 품목은 더할 것이 없다.** */
export function totalApproved(items: readonly ItemRow[]): number {
  return items.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0)
}

/**
 * 이 요청이 기대는 예산에서 아직 쓸 수 있는 돈.
 *
 * **배정에서 무엇을 빼는지를 명세가 예로 남겼다.** `event.financeSummary`와
 * `finance.orgOverview`가 같은 셈을 든다 — 배정 3,000,000에서 지출 예정
 * 1,100,000과 실제 지출 950,000을 빼면 사용 가능 950,000이고, 조직 쪽의 넷도
 * 같은 식으로 맞는다. 그래서 규칙은 **배정 − 실제 지출 − 아직 안 낸 승인액**이다.
 *
 * 예산 항목이 하나도 없으면 뺄 바탕이 없다. 그때는 수가 아니라 **그 사실**을
 * 말로 준다 — 0원은 '예산이 0원이다'라는 다른 사실이기 때문이다.
 *
 * 행사에 딸리지 않은 요청은 학생회의 상시 항목(eventId가 빈 항목)을 본다.
 */
export async function budgetAvailable(
  db: Db,
  orgId: string,
  eventId: string | null,
): Promise<number | null> {
  const scope = eventId === null ? isNull(budgetItems.eventId) : eq(budgetItems.eventId, eventId)
  const budget = await db
    .select({ total: sql<number>`coalesce(sum(${budgetItems.amount}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(budgetItems)
    .where(and(eq(budgetItems.orgId, orgId), scope))
  if ((budget[0]?.count ?? 0) === 0) return null

  const requestScope =
    eventId === null ? isNull(purchaseRequests.eventId) : eq(purchaseRequests.eventId, eventId)

  const paid = await db
    .select({ total: sql<number>`coalesce(sum(${payments.paidAmount}), 0)::int` })
    .from(payments)
    .innerJoin(
      purchaseRequests,
      and(
        eq(payments.requestId, purchaseRequests.id),
        eq(purchaseRequests.orgId, orgId),
        requestScope,
      ),
    )
    .where(eq(payments.orgId, orgId))

  // **아직 안 낸 승인액만 더한다.** 결제된 것은 위에서 이미 실제 지출로 셌다 —
  // 둘 다 더하면 같은 돈을 두 번 뺀다.
  const committed = await db
    .select({ total: sql<number>`coalesce(sum(${purchaseRequestItems.approvedAmount}), 0)::int` })
    .from(purchaseRequestItems)
    .innerJoin(
      purchaseRequests,
      and(
        eq(purchaseRequestItems.requestId, purchaseRequests.id),
        eq(purchaseRequests.orgId, orgId),
        requestScope,
      ),
    )
    .where(and(eq(purchaseRequestItems.orgId, orgId), isNull(purchaseRequestItems.paymentId)))

  return (budget[0]?.total ?? 0) - (paid[0]?.total ?? 0) - (committed[0]?.total ?? 0)
}
