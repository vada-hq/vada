import { and, eq, sql } from 'drizzle-orm'
import { recordVersion, shipmentItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'

// 연결 표 자체는 기록이 아니다. 같은 거래에서 방금 연 배송 판에 품목 목록도 담아 이전 연결을 보존한다(PRIN-3).
// 부르는 쪽은 학생회·요청·배송 잠금을 잡고 승인 품목을 확인한다.
export async function writeShipmentItems(
  tx: Tx,
  shipmentId: string,
  councilId: string,
  ids: string[],
) {
  await tx.delete(shipmentItem).where(eq(shipmentItem.shipmentId, shipmentId))
  await tx
    .insert(shipmentItem)
    .values(ids.map(lineItemId => ({ shipmentId, lineItemId, councilId })))
  await tx
    .update(recordVersion)
    .set({
      data: sql`${recordVersion.data} || jsonb_build_object('line_item_ids', ${JSON.stringify([...ids].sort())}::jsonb)`,
    })
    .where(and(eq(recordVersion.recordId, shipmentId), sql`upper_inf(${recordVersion.valid})`))
}
