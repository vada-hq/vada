import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { at, day, won } from './schema-columns.js'

// 일
export const task = pgTable('task', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('task'),
  title: text('title').notNull(),
  body: text('body'),
  dueAt: at('due_at'),
  status: text('status').notNull().default('todo'),
  recurrence: text('recurrence'),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
  assigneeId: uuid('assignee_id'),
  cancelledAt: at('cancelled_at'),
})

export const request = pgTable('request', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('request'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  requestedBy: uuid('requested_by').notNull(),
  neededBy: day('needed_by'),
  defaultBudgetItemId: uuid('default_budget_item_id'),
  cancelledAt: at('cancelled_at'),
})

export const lineItem = pgTable('line_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('line_item'),
  requestId: uuid('request_id').notNull(),
  name: text('name').notNull(),
  link: text('link'),
  options: text('options'),
  quantity: integer('quantity').notNull(),
  amount: won('amount'),
  budgetItemId: uuid('budget_item_id'),
})

export const paymentLine = pgTable('payment_line', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('payment_line'),
  expenseId: uuid('expense_id').notNull(),
  lineItemId: uuid('line_item_id').notNull(),
  amount: won('amount').notNull(),
})

export const registrationForm = pgTable('registration_form', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('registration_form'),
  eventId: uuid('event_id').notNull(),
  name: text('name').notNull(),
  opensAt: at('opens_at'),
  closesAt: at('closes_at').notNull(),
  capacity: integer('capacity'),
  notice: text('notice'),
  collectsPhone: boolean('collects_phone').notNull().default(false),
  pausedAt: at('paused_at'),
  publicCode: text('public_code').notNull(),
  payerFee: won('payer_fee'),
  nonPayerFee: won('non_payer_fee'),
  feeAccountId: uuid('fee_account_id'),
})

export const registration = pgTable('registration', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('registration'),
  formId: uuid('form_id').notNull(),
  name: text('name'),
  studentId: text('student_id'),
  phone: text('phone'),
  appliedFee: won('applied_fee').notNull(),
  cancelledAt: at('cancelled_at'),
})

export const deposit = pgTable('deposit', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('deposit'),
  registrationId: uuid('registration_id').notNull(),
  amount: won('amount').notNull(),
  confirmedAt: at('confirmed_at').notNull(),
  incomeId: uuid('income_id'),
})

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('attendance'),
  registrationId: uuid('registration_id').notNull(),
  confirmedAt: at('confirmed_at').notNull(),
})

export const meeting = pgTable('meeting', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('meeting'),
  title: text('title').notNull(),
  heldAt: at('held_at').notNull(),
  eventId: uuid('event_id'),
  hostDepartmentId: uuid('host_department_id'),
})

export const agendaItem = pgTable('agenda_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('agenda_item'),
  meetingId: uuid('meeting_id').notNull(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  body: text('body'),
})

export const poll = pgTable('poll', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll'),
  title: text('title').notNull(),
  closesAt: at('closes_at'),
  closedAt: at('closed_at'),
  originId: uuid('origin_id'),
  originKind: text('origin_kind'),
})

export const pollOption = pgTable('poll_option', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll_option'),
  pollId: uuid('poll_id').notNull(),
  position: integer('position').notNull(),
  label: text('label').notNull(),
})

export const pollResponse = pgTable('poll_response', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll_response'),
  pollId: uuid('poll_id').notNull(),
  memberId: uuid('member_id').notNull(),
  optionId: uuid('option_id').notNull(),
})
