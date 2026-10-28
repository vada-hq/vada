import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { at } from './schema-columns.js'

export const calendarFeed = pgTable(
  'calendar_feed',
  {
    memberId: uuid('member_id').notNull(),
    councilId: uuid('council_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.memberId, table.councilId] })],
)
