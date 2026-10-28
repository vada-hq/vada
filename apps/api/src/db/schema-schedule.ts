import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { at, day } from './schema-columns.js'

export const scheduleItem = pgTable('schedule_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('schedule_item'),
  councilId: uuid('council_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  startsOn: day('starts_on'),
  endsOn: day('ends_on'),
  startsAt: at('starts_at'),
  endsAt: at('ends_at'),
  place: text('place'),
  memo: text('memo'),
  visibility: text('visibility').notNull().default('council'),
  departmentId: uuid('department_id'),
  eventId: uuid('event_id'),
  cancelledAt: at('cancelled_at'),
})
