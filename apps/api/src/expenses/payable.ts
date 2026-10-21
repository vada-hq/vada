import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { approval, lineItem, record, request } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

// 결제할 수 있는 품목은 이 학생회의 취소되지 않은 요청에서 승인된 것이다. 승인은 되돌리지 않고 결재가 시작된 요청은 취소할 수 없어,
// 이 읽기 뒤에 품목이 결제할 수 없게 바뀌지 않는다(같은 학생회의 쓰기는 학생회 행 잠금으로 한 줄로 선다).
export async function assertPayable(tx: Tx, actor: Actor, lineItemIds: readonly string[]) {
  if (!lineItemIds.length) return
  const rows = await tx
    .select({ id: lineItem.id })
    .from(lineItem)
    .innerJoin(request, and(eq(request.id, lineItem.requestId), isNull(request.cancelledAt)))
    .innerJoin(record, eq(record.id, lineItem.id))
    .innerJoin(
      approval,
      and(
        eq(approval.targetId, lineItem.id),
        eq(approval.targetKind, 'line_item'),
        eq(approval.outcome, 'approved'),
      ),
    )
    .where(and(inArray(lineItem.id, [...lineItemIds]), eq(record.councilId, actor.councilId)))
  if (rows.length !== lineItemIds.length) throw new ApiError('LINE_ITEM_NOT_PAYABLE')
}
