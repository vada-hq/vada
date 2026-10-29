import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { PurchaseItemBrief } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  department,
  departmentMembership,
  lineItem,
  record,
  request,
  shipment,
  shipmentItem,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { lastOutcomeOf } from './last-outcome.js'
import { lineItemStatusOf } from './policy.js'
import { isPaid } from './summary.js'

type Reader = Pick<Db, 'select'>

// 구매 칸반은 품목 하나가 카드 한 장이라(와이어프레임 PUR-00) 목록에 실린 요청의 품목을 한 번에 읽는다.
// 요청 번호는 이미 학생회로 거른 목록에서 오지만, 기록의 학생회로 한 번 더 건다.
export async function itemBriefsOf(
  db: Reader,
  actor: Actor,
  requestIds: string[],
): Promise<Map<string, PurchaseItemBrief[]>> {
  const found = new Map<string, PurchaseItemBrief[]>()
  if (requestIds.length === 0) return found
  const rows = await db
    .select({
      id: lineItem.id,
      requestId: lineItem.requestId,
      name: lineItem.name,
      quantity: lineItem.quantity,
      unitPrice: lineItem.estimatedUnitPrice,
      shippingFee: lineItem.estimatedShippingFee,
      amount: lineItem.amount,
      outcome: lastOutcomeOf(lineItem.id),
      paid: sql<boolean>`${isPaid}`.mapWith(Boolean),
      shipped:
        sql<boolean>`exists (select 1 from ${shipmentItem} inner join ${shipment} on ${shipment.id} = ${shipmentItem.shipmentId} where ${shipmentItem.lineItemId} = ${lineItem.id} and ${shipment.cancelledAt} is null)`.mapWith(
          Boolean,
        ),
    })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .where(and(eq(record.councilId, actor.councilId), inArray(lineItem.requestId, requestIds)))
    .orderBy(asc(record.createdAt), asc(lineItem.id))
  for (const row of rows) {
    const list = found.get(row.requestId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      estimate: estimateOf(row),
      amount: row.amount === null ? null : Number(row.amount),
      status: lineItemStatusOf(row.outcome),
      paid: row.paid,
      shipped: row.shipped,
    })
    found.set(row.requestId, list)
  }
  return found
}

// 수량 × 예상 단가 + 배송비. 배송비를 모르면 상품 값만 센다(요청 목록의 '배송비 미확인'과 같은 값).
// 금액 칸(numeric)은 문자열로 온다.
function estimateOf(row: {
  quantity: number
  unitPrice: string | null
  shippingFee: string | null
}) {
  if (row.unitPrice === null) return null
  return row.quantity * Number(row.unitPrice) + Number(row.shippingFee ?? 0)
}

// 요청한 사람의 지금 부서 이름(저장하지 않고 읽을 때 센다, 겸직이면 모두, 재정 통합 F9). 지출 목록의 부서와 같은 기준이다.
export async function requesterDepartmentsOf(
  db: Reader,
  actor: Actor,
  requestIds: string[],
): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  if (requestIds.length === 0) return found
  const rows = await db
    .select({ requestId: request.id, name: department.name })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(
      departmentMembership,
      and(
        eq(departmentMembership.memberId, request.requestedBy),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
    .innerJoin(
      department,
      and(
        eq(department.id, departmentMembership.departmentId),
        eq(department.councilId, actor.councilId),
      ),
    )
    .where(and(eq(record.councilId, actor.councilId), inArray(request.id, requestIds)))
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  for (const row of rows) {
    const list = found.get(row.requestId) ?? []
    if (!list.includes(row.name)) list.push(row.name)
    found.set(row.requestId, list)
  }
  return found
}
