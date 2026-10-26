import { sql } from 'drizzle-orm'
import { lineItem } from '../db/schema.js'

// summaryRows가 이미 합친 품목에서 한 번에 센다. 하나라도 모르면 그 합계도 모른다.
export const estimateColumns = () => ({
  estimatedSubtotal: sql<
    number | null
  >`case when bool_and(${lineItem.estimatedUnitPrice} is not null)
    then sum(${lineItem.quantity} * ${lineItem.estimatedUnitPrice}) end`.mapWith(Number),
  estimatedTotal: sql<
    number | null
  >`case when bool_and(${lineItem.estimatedUnitPrice} is not null and ${lineItem.estimatedShippingFee} is not null)
    then sum(${lineItem.quantity} * ${lineItem.estimatedUnitPrice} + ${lineItem.estimatedShippingFee}) end`.mapWith(
    Number,
  ),
})
