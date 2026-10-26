import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { at } from './schema-columns.js'

export const shipment = pgTable('shipment', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('shipment'),
  councilId: uuid('council_id').notNull(),
  requestId: uuid('request_id').notNull(),
  carrierId: text('carrier_id').notNull(),
  trackingNumber: text('tracking_number').notNull(),
  cancelledAt: at('cancelled_at'),
})
// 같은 학생회인지는 SQL의 복합 외래 키가 지킨다.
export const shipmentItem = pgTable(
  'shipment_item',
  {
    shipmentId: uuid('shipment_id').notNull(),
    lineItemId: uuid('line_item_id').notNull(),
    councilId: uuid('council_id').notNull(),
  },
  table => [primaryKey({ columns: [table.shipmentId, table.lineItemId] })],
)
