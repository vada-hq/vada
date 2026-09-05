import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { members, purchaseOrders } from '../db/schema.ts'
import {
  BLANK,
  dayOf,
  joinParts,
  orNote,
  quantityNote,
  statusOf,
  won,
  type Tone,
} from './labels.ts'
import { itemRows, requestRow, totalApproved, type ItemRow } from './requests.ts'

// 구매·발주 처리(FIN-PROC-01).
//
// **묶음 하나가 업체 하나다** — 명세가 그렇게 적었다. 품목을 어느 업체에서 사느냐로
// 주문이 갈리고, 주문일도 담당도 배송도 업체마다 따로 간다.
//
// **주문 상태와 배송 상태는 표에 없다.** `db/schema.ts`가 그렇게 못 박았다 —
// '주문 완료'는 발주에 실렸다는 뜻이고 '배송 중'은 올 날이 잡혔는데 아직 안 왔다는
// 뜻이라, 값으로 또 두면 사실과 말이 갈릴 자리가 생긴다.

export interface PurchaseOrderSummary {
  eventName: string
  code: string
  status: string
  statusTone: string
  title: string
  requesterNote: string
  approvedAmountNote: string
}

export async function purchaseOrderSummary(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PurchaseOrderSummary | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  const items = await itemRows(db, orgId, row.id)
  const status = statusOf(row.stage, row.supplementRequestedAt)
  const neededOn = dayOf(row.neededOn)

  return {
    eventName: orNote(row.eventName, '상시 지출'),
    code: orNote(row.code, '번호 미정'),
    status: status.label,
    statusTone: status.tone,
    title: row.title,
    // 누가 언제까지 필요하다 했는지가 한 줄로 온다. 없는 조각은 빼고 잇는다.
    requesterNote: orNote(
      joinParts([
        row.departmentName,
        row.requesterName,
        neededOn === null ? null : `필요한 날짜 ${neededOn}`,
      ]),
      '요청자 미정',
    ),
    // **'요청액'이 아니라 '승인된 금액'이다** — 무엇이 승인됐는지는 검토가 정했고
    // 이 단계는 그것을 사서 받는 일이다.
    approvedAmountNote: won(totalApproved(items)),
  }
}

export interface PurchaseOrderItem {
  id: string
  name: string
  quantityNote: string
  amountNote: string
  orderStatus: string
  orderStatusTone: string
  deliveryOn: string
  deliveryStatus: string
  deliveryStatusTone: string
}

export interface PurchaseOrderGroup {
  id: string
  vendor: string
  orderNote: string
  amountNote: string
  items: PurchaseOrderItem[]
}

/**
 * 이 요청의 발주들.
 *
 * **아직 주문하지 않은 업체도 온다** — 주문일과 담당이 '—'로 오고 그 묶음의 품목은
 * 아직 주문되지 않은 것이다. 없는 것과 아직 안 한 것은 다르다.
 */
export async function purchaseOrderList(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PurchaseOrderGroup[] | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  const orders = await db
    .select({
      id: purchaseOrders.id,
      vendor: purchaseOrders.vendor,
      orderedOn: purchaseOrders.orderedOn,
      ordererName: members.name,
    })
    .from(purchaseOrders)
    .leftJoin(
      members,
      and(eq(purchaseOrders.ordererMemberId, members.id), eq(members.orgId, orgId)),
    )
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.requestId, row.id)))
    // 주문한 것이 먼저, 아직 안 한 것은 뒤로. 빈 날짜는 Postgres가 뒤에 놓는다.
    .orderBy(asc(purchaseOrders.orderedOn), asc(purchaseOrders.vendor))

  const items = await itemRows(db, orgId, row.id)

  return orders.map((order) => {
    const mine = items.filter((item) => item.orderId === order.id)
    const orderedOn = dayOf(order.orderedOn)
    return {
      id: order.id,
      vendor: order.vendor,
      orderNote: `주문일 ${orderedOn ?? BLANK} · 담당 ${order.ordererName ?? BLANK}`,
      amountNote: won(mine.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0)),
      items: mine.map((item) => lineOf(item, order.orderedOn !== null)),
    }
  })
}

/** 주문이 어디까지 됐는지. **발주에 실렸고 그 발주가 나갔으면 주문 완료다.** */
function orderState(ordered: boolean): Tone {
  return ordered ? { label: '주문 완료', tone: 'green' } : { label: '주문 대기', tone: 'gray' }
}

/**
 * 배송이 어디까지 됐는지.
 *
 * **딱지가 아니라 글에 색이 붙는 자리다**(명세가 그렇게 적었다). 셋을 가르는 것은
 * 표에 있는 사실 둘이다 — 받은 날이 찍혔는가, 올 날이 잡혔는가.
 */
function deliveryState(item: ItemRow, ordered: boolean): Tone {
  if (item.deliveredAt !== null) return { label: '배송 완료', tone: 'green' }
  if (item.expectedDeliveryOn !== null) return { label: '배송 중', tone: 'blue' }
  return ordered ? { label: '배송 예정', tone: 'gray' } : { label: BLANK, tone: 'gray' }
}

function lineOf(item: ItemRow, ordered: boolean): PurchaseOrderItem {
  const order = orderState(ordered)
  const delivery = deliveryState(item, ordered)
  return {
    id: item.id,
    name: item.name,
    quantityNote: quantityNote(item.quantity, item.unit),
    // 검토에서 승인된 금액이다. 아직 판정하지 않았으면 셀 것이 없다.
    amountNote: item.approvedAmount === null ? '금액 미정' : won(item.approvedAmount),
    orderStatus: order.label,
    orderStatusTone: order.tone,
    deliveryOn: dayOf(item.expectedDeliveryOn) ?? BLANK,
    deliveryStatus: delivery.label,
    deliveryStatusTone: delivery.tone,
  }
}
