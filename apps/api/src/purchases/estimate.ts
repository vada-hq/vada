import { sql } from 'drizzle-orm'
import { lineItem, request } from '../db/schema.js'
import { lastOutcomeOf } from './last-outcome.js'

// 살 품목: 요청이 취소되지 않았고 품목이 반려·취소되지 않았다(대기와 승인이 든다).
// 요청을 취소해도 품목의 결재 줄은 생기지 않아 요청의 취소도 함께 본다.
const buying = () =>
  sql`(${request.cancelledAt} is null and coalesce(${lastOutcomeOf(lineItem.id)}, 'pending') not in ('rejected', 'cancelled'))`

// summaryRows가 이미 합친 품목에서 살 품목만 한 번에 센다. 하나라도 모르면 그 합계도 모른다.
// 배송비는 품목마다라 뺀 품목의 배송비도, 그 품목의 모르는 값도 합계에 닿지 않는다. 살 품목이 없으면 0이다(purchaseEstimatesOf와 같다).
export const estimateColumns = () => {
  const live = buying()
  return {
    buyingItems: sql<number>`count(*) filter (where ${live})`.mapWith(Number),
    estimatedSubtotal: sql<
      number | null
    >`case when coalesce(bool_and(${lineItem.estimatedUnitPrice} is not null) filter (where ${live}), true)
      then coalesce(sum(${lineItem.quantity} * ${lineItem.estimatedUnitPrice}) filter (where ${live}), 0) end`.mapWith(
      Number,
    ),
    estimatedTotal: sql<
      number | null
    >`case when coalesce(bool_and(${lineItem.estimatedUnitPrice} is not null and ${lineItem.estimatedShippingFee} is not null) filter (where ${live}), true)
      then coalesce(sum(${lineItem.quantity} * ${lineItem.estimatedUnitPrice} + ${lineItem.estimatedShippingFee}) filter (where ${live}), 0) end`.mapWith(
      Number,
    ),
  }
}
