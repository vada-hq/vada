import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { budgetItems, payments, purchaseRequestItems, purchaseRequests } from '../db/schema.ts'

// 학생회가 쓴 돈과 쓸 돈을 **한 정의로** 읽는다.
//
// 전체 재정 현황(FIN-00)·사용 내역(FIN-LEDGER-01)·구매 요청 검토(FIN-REV-01)·홈의 재정
// 요약이 전부 같은 두 표를 센다 — 결제(`payments`)가 실제 지출이고, 결제에 딸리지 않은
// 승인액(`purchase_request_items.approvedAmount`)이 지출 예정이다. 사람이 정한 셈
// (2026-09-05, `docs/decisions/budget-screen.md`)이고 `requests.ts`의 `budgetAvailable`이
// 그 셈을 SQL로 든다. 여기는 같은 두 표의 **줄**을 읽는 자리다 — 겉면은 더하고 장부는
// 줄마다 그린다. 무엇이 지출이고 무엇이 예정인지가 두 곳에서 갈리면 카드와 그 '내역'이
// 다른 돈을 말한다.

/** 결제 한 건과 그것이 딸린 요청의 행사. **자기 학생회의 요청에 딸린 것만** 읽는다. */
export interface PaidRow {
  paymentId: string
  requestId: string
  eventId: string | null
  paidOn: Date | null
  paidAmount: number
}

export async function paidRows(db: Db, orgId: string): Promise<PaidRow[]> {
  const rows = await db
    .select({
      paymentId: payments.id,
      requestId: payments.requestId,
      eventId: purchaseRequests.eventId,
      paidOn: payments.paidOn,
      paidAmount: payments.paidAmount,
    })
    .from(payments)
    .innerJoin(
      purchaseRequests,
      and(eq(payments.requestId, purchaseRequests.id), eq(purchaseRequests.orgId, orgId)),
    )
    .where(eq(payments.orgId, orgId))
  return rows
}

/** 품목 한 줄과 그것이 기대는 예산 항목·요청의 행사. */
export interface MoneyItem {
  id: string
  requestId: string
  eventId: string | null
  sortOrder: number
  name: string
  budgetItemId: string | null
  budgetItemName: string | null
  /** 그 예산 항목의 담당 부서. 행사 항목은 담당 부서가 없다(`db/schema.ts`). */
  budgetDepartmentId: string | null
  approvedAmount: number | null
  paymentId: string | null
}

export async function moneyItems(db: Db, orgId: string): Promise<MoneyItem[]> {
  const rows = await db
    .select({
      id: purchaseRequestItems.id,
      requestId: purchaseRequestItems.requestId,
      eventId: purchaseRequests.eventId,
      sortOrder: purchaseRequestItems.sortOrder,
      name: purchaseRequestItems.name,
      budgetItemId: purchaseRequestItems.budgetItemId,
      budgetItemName: budgetItems.name,
      budgetDepartmentId: budgetItems.departmentId,
      approvedAmount: purchaseRequestItems.approvedAmount,
      paymentId: purchaseRequestItems.paymentId,
    })
    .from(purchaseRequestItems)
    .innerJoin(
      purchaseRequests,
      and(
        eq(purchaseRequestItems.requestId, purchaseRequests.id),
        eq(purchaseRequests.orgId, orgId),
      ),
    )
    // 이어 붙인 표도 자기 조직을 확인한다(`requests.ts`의 itemRows와 같다).
    .leftJoin(
      budgetItems,
      and(eq(purchaseRequestItems.budgetItemId, budgetItems.id), eq(budgetItems.orgId, orgId)),
    )
    .where(eq(purchaseRequestItems.orgId, orgId))
    .orderBy(purchaseRequestItems.sortOrder, purchaseRequestItems.id)
  return rows
}

/**
 * 아직 안 낸 승인 — **지출 예정**. 결제에 딸린 것은 실결제로 이미 셌다.
 *
 * `budgetAvailable`이 `paymentId IS NULL`인 품목의 `approvedAmount`를 더하는 것과 같은
 * 정의다. 판정하지 않은 품목은 승인액이 없으므로 예정도 아니다.
 */
export function isCommitted(item: MoneyItem): item is MoneyItem & { approvedAmount: number } {
  return item.paymentId === null && item.approvedAmount !== null
}

/** 실제 지출의 합. */
export function sumPaid(rows: readonly PaidRow[]): number {
  return rows.reduce((sum, row) => sum + row.paidAmount, 0)
}

/** 지출 예정의 합. */
export function sumCommitted(items: readonly MoneyItem[]): number {
  return items.filter(isCommitted).reduce((sum, item) => sum + item.approvedAmount, 0)
}

export interface PlannedGroup {
  requestId: string
  items: Array<MoneyItem & { approvedAmount: number }>
  amount: number
}

/**
 * 지출 예정을 **요청 단위로 묶은 것.** 장부의 예정 줄 하나가 이것이고, 겉면의
 * '결제 예정 N건'이 이것을 센다 — 결제가 요청의 품목을 묶어 나가듯 예정도 그 단위다.
 *
 * **돈이 걸리지 않은 묶음은 없다.** 승인액이 0뿐인 요청은 쓸 돈이 없으므로 줄도 건수도
 * 되지 않는다(홈의 재정 요약과 같은 규칙).
 */
export function plannedGroups(items: readonly MoneyItem[]): PlannedGroup[] {
  const byRequest = new Map<string, PlannedGroup>()
  for (const item of items) {
    if (!isCommitted(item)) continue
    const group = byRequest.get(item.requestId) ?? { requestId: item.requestId, items: [], amount: 0 }
    group.items.push(item)
    group.amount += item.approvedAmount
    byRequest.set(item.requestId, group)
  }
  return [...byRequest.values()].filter((group) => group.amount > 0)
}
