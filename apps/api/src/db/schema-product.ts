import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { at } from './schema-columns.js'

// 불러온 쿠팡 상품 정보(기능 022 정한 것 17). 학생회·사람·메시지와 잇지 않는 공개 정보라 기록이 아니다(0029의 까닭).
export const productInfo = pgTable('product_info', {
  url: text('url').primaryKey(),
  outcome: text('outcome').notNull(),
  product: jsonb('product'),
  fetchedAt: at('fetched_at').notNull(),
})
