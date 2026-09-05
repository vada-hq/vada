import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '../db/client.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  purchaseRequestItems,
  purchaseRequests,
} from '../db/schema.ts'
import type { PurchaseStage } from '../finance/labels.ts'

// 구매 요청 한 건과 그 품목을 읽는 자리.
//
// **재정의 읽기(`finance/requests.ts`)와 같은 표를 본다** — 다만 저쪽은 검토·구매·증빙 화면이
// 그리는 조각만 집고, 이쪽은 쓰는 흐름이 필요한 것(요청자·검토자·보완 기한·품목의 모든 칸)까지
// 집는다. 이어 붙인 표도 자기 조직을 확인하는 규칙은 같다 — id만 이으면 남의 조직의 이름이
// 우리 요청에 그려진다.

/** 검토자도 구성원이다. 요청자와 같은 표를 두 번 이으므로 이름을 하나 더 붙인다. */
const reviewers = alias(members, 'reviewers')

export interface RequestRow {
  id: string
  eventId: string | null
  code: string | null
  title: string
  purpose: string | null
  departmentId: string | null
  requesterMemberId: string | null
  priority: string | null
  neededOn: Date | null
  stage: PurchaseStage
  submittedAt: Date | null
  reviewedByMemberId: string | null
  reviewedAt: Date | null
  supplementRequestedAt: Date | null
  supplementDueOn: Date | null
  evidenceCompletedAt: Date | null
  eventName: string | null
  departmentName: string | null
  requesterName: string | null
  reviewerName: string | null
}

/** 그 요청 한 건. 없으면 null이다 — 남의 학생회 요청도 없는 것이다. */
export async function requestOf(db: Db, orgId: string, requestId: string): Promise<RequestRow | null> {
  if (requestId === '') return null
  const rows = await db
    .select({
      id: purchaseRequests.id,
      eventId: purchaseRequests.eventId,
      code: purchaseRequests.code,
      title: purchaseRequests.title,
      purpose: purchaseRequests.purpose,
      departmentId: purchaseRequests.departmentId,
      requesterMemberId: purchaseRequests.requesterMemberId,
      priority: purchaseRequests.priority,
      neededOn: purchaseRequests.neededOn,
      stage: purchaseRequests.stage,
      submittedAt: purchaseRequests.submittedAt,
      reviewedByMemberId: purchaseRequests.reviewedByMemberId,
      reviewedAt: purchaseRequests.reviewedAt,
      supplementRequestedAt: purchaseRequests.supplementRequestedAt,
      supplementDueOn: purchaseRequests.supplementDueOn,
      evidenceCompletedAt: purchaseRequests.evidenceCompletedAt,
      eventName: events.title,
      departmentName: departments.name,
      requesterName: members.name,
      reviewerName: reviewers.name,
    })
    .from(purchaseRequests)
    .leftJoin(events, and(eq(purchaseRequests.eventId, events.id), eq(events.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(purchaseRequests.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(purchaseRequests.requesterMemberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      reviewers,
      and(eq(purchaseRequests.reviewedByMemberId, reviewers.id), eq(reviewers.orgId, orgId)),
    )
    .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, requestId)))
    .limit(1)
  return (rows[0] as RequestRow | undefined) ?? null
}

export type ReviewResult = 'approved' | 'supplement' | 'rejected'
export type QuoteStatus = 'none' | 'requested' | 'received'

export interface ItemRow {
  id: string
  requestId: string
  sortOrder: number
  name: string
  category: string | null
  purchaseType: string | null
  budgetItemId: string | null
  budgetItemName: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  vendor: string | null
  productUrl: string | null
  option: string | null
  deliveryNote: string | null
  quoteStatus: QuoteStatus
  reviewResult: ReviewResult | null
  approvedAmount: number | null
  reviewNote: string | null
  supplementAnswers: unknown
  orderId: string | null
  paymentId: string | null
}

const ITEM = {
  id: purchaseRequestItems.id,
  requestId: purchaseRequestItems.requestId,
  sortOrder: purchaseRequestItems.sortOrder,
  name: purchaseRequestItems.name,
  category: purchaseRequestItems.category,
  purchaseType: purchaseRequestItems.purchaseType,
  budgetItemId: purchaseRequestItems.budgetItemId,
  budgetItemName: budgetItems.name,
  quantity: purchaseRequestItems.quantity,
  unit: purchaseRequestItems.unit,
  unitPrice: purchaseRequestItems.unitPrice,
  vendor: purchaseRequestItems.vendor,
  productUrl: purchaseRequestItems.productUrl,
  option: purchaseRequestItems.option,
  deliveryNote: purchaseRequestItems.deliveryNote,
  quoteStatus: purchaseRequestItems.quoteStatus,
  reviewResult: purchaseRequestItems.reviewResult,
  approvedAmount: purchaseRequestItems.approvedAmount,
  reviewNote: purchaseRequestItems.reviewNote,
  supplementAnswers: purchaseRequestItems.supplementAnswers,
  orderId: purchaseRequestItems.orderId,
  paymentId: purchaseRequestItems.paymentId,
}

/** 그 요청의 품목들. 적은 차례대로 온다. */
export async function itemsOf(db: Db, orgId: string, requestId: string): Promise<ItemRow[]> {
  const rows = await db
    .select(ITEM)
    .from(purchaseRequestItems)
    .leftJoin(
      budgetItems,
      and(eq(purchaseRequestItems.budgetItemId, budgetItems.id), eq(budgetItems.orgId, orgId)),
    )
    .where(and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.requestId, requestId)))
    .orderBy(asc(purchaseRequestItems.sortOrder), asc(purchaseRequestItems.id))
  return rows as ItemRow[]
}

/** 품목 하나. 보완 칸을 묻는 자리가 품목으로 묻는다. */
export async function itemOf(db: Db, orgId: string, itemId: string): Promise<ItemRow | null> {
  if (itemId === '') return null
  const rows = await db
    .select(ITEM)
    .from(purchaseRequestItems)
    .leftJoin(
      budgetItems,
      and(eq(purchaseRequestItems.budgetItemId, budgetItems.id), eq(budgetItems.orgId, orgId)),
    )
    .where(and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.id, itemId)))
    .limit(1)
  return (rows[0] as ItemRow | undefined) ?? null
}

/** 그 행사가 이 학생회의 것인가. */
export async function eventExists(db: Db, orgId: string, eventId: string): Promise<boolean> {
  if (eventId === '') return false
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows.length > 0
}

/** 이 구성원의 소속 부서. 요청 부서는 여기서 온다 — 몸통에 실린 이름을 믿지 않는다. */
export async function departmentOfMember(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<{ id: string | null; name: string | null }> {
  const rows = await db
    .select({ id: departments.id, name: departments.name })
    .from(members)
    .leftJoin(departments, and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)))
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const found = rows[0]
  return found === undefined ? { id: null, name: null } : { id: found.id, name: found.name }
}
