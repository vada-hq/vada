import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { at, day, won } from './schema-columns.js'

// 돈
export const fiscalPeriod = pgTable('fiscal_period', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('fiscal_period'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  startsOn: day('starts_on').notNull(),
  endsOn: day('ends_on').notNull(),
  previousPeriodId: uuid('previous_period_id'),
})

export const budget = pgTable('budget', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('budget'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
})

export const account = pgTable('account', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('account'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  bank: text('bank').notNull(),
  accountNumber: text('account_number').notNull(),
  holder: text('holder').notNull(),
  type: text('type').notNull(),
  closedOn: day('closed_on'),
})

export const event = pgTable('event', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('event'),
  name: text('name').notNull(),
  startsAt: at('starts_at'),
  endsAt: at('ends_at'),
  place: text('place'),
  ownerId: uuid('owner_id'),
  previousEventId: uuid('previous_event_id'),
})

export const budgetItem = pgTable('budget_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('budget_item'),
  budgetId: uuid('budget_id').notNull(),
  type: text('type').notNull(),
  purpose: text('purpose').notNull(),
  amount: won('amount').notNull(),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
})

export const income = pgTable('income', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('income'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  source: text('source').notNull(),
  amount: won('amount').notNull(),
  receivedOn: day('received_on').notNull(),
  description: text('description'),
  budgetItemId: uuid('budget_item_id'),
  accountId: uuid('account_id'),
  cancelledAt: at('cancelled_at'),
})

export const expense = pgTable('expense', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('expense'),
  amount: won('amount').notNull(),
  paidAt: at('paid_at').notNull(),
  description: text('description').notNull(),
  vendor: text('vendor').notNull(),
  method: text('method').notNull(),
  reason: text('reason'),
  eventId: uuid('event_id'),
  budgetItemId: uuid('budget_item_id'),
  requestedBy: uuid('requested_by'),
  paidBy: uuid('paid_by'),
  reimbursedAt: at('reimbursed_at'),
  accountId: uuid('account_id'),
  cancelledAt: at('cancelled_at'),
})

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('evidence'),
  expenseId: uuid('expense_id').notNull(),
  type: text('type').notNull(),
})

export const accountClosing = pgTable('account_closing', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('account_closing'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  publishedAt: at('published_at'),
})

export const feePayment = pgTable('fee_payment', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('fee_payment'),
  councilId: uuid('council_id').notNull(),
  studentId: text('student_id'),
  paidFrom: day('paid_from').notNull(),
  paidUntil: day('paid_until').notNull(),
})
