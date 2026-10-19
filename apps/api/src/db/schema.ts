import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// 조회용 표 정의다. 표는 마이그레이션(SQL)이 만들고, 이 파일로 표를 만들지 않는다(다시 만들기 설계서).
// 표와 칸, 타입, NULL 여부만 맞춘다. 외래 키, UNIQUE, CHECK, EXCLUDE, 부분 유일 인덱스는 SQL에만 있다.
// 마이그레이션 DB와 같은지는 schema-match.test.ts가 확인한다.

const at = (name: string) => timestamp(name, { withTimezone: true })
const day = (name: string) => date(name, { mode: 'string' })
const won = (name: string) => numeric(name, { precision: 14, scale: 0 })
// drizzle에 없는 PostgreSQL 범위 타입. 칸과 타입만 맞춘다. 값은 '["2026-10-19 00:00:00+00",)' 같은 글자다.
const tstzrange = customType<{ data: string; driverData: string }>({ dataType: () => 'tstzrange' })

// 로그인 표 4개(better-auth). 지금 정의 그대로다.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    // Better Auth 기본 스키마 호환 필드이며, 비밀번호 로그인을 활성화하지 않는다.
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    unique('accounts_provider_account_unique').on(table.providerId, table.accountId),
    index('accounts_user_id_idx').on(table.userId),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [index('sessions_user_id_idx').on(table.userId)],
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [index('verifications_identifier_idx').on(table.identifier)],
)

// 공통(physical-model.md)
export const record = pgTable('record', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  kind: text('kind').notNull(),
  councilId: uuid('council_id'),
  createdBy: uuid('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  confirmedBy: uuid('confirmed_by'),
  confirmedAt: at('confirmed_at'),
})

export const recordVersion = pgTable(
  'record_version',
  {
    recordId: uuid('record_id').notNull(),
    versionNo: integer('version_no').notNull(),
    valid: tstzrange('valid').notNull(),
    data: jsonb('data').notNull(),
    changedBy: uuid('changed_by'),
    reason: text('reason'),
  },
  table => [primaryKey({ columns: [table.recordId, table.versionNo] })],
)

// 조직
export const council = pgTable('council', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('council'),
  name: text('name').notNull(),
  unit: text('unit').$type<'department' | 'college' | 'university'>().notNull(),
  schoolName: text('school_name').notNull(),
  presidentTitle: text('president_title').notNull().default('회장'),
  vicePresidentTitle: text('vice_president_title').notNull().default('부회장'),
  headTitle: text('head_title').notNull().default('부장'),
  viceHeadTitle: text('vice_head_title').notNull().default('부부장'),
})

export const member = pgTable('member', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('member'),
  name: text('name').notNull(),
  email: text('email').notNull(),
})

export const cohort = pgTable('cohort', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('cohort'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  startsOn: day('starts_on').notNull(),
  endsOn: day('ends_on').notNull(),
})

export const councilMembership = pgTable('council_membership', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('council_membership'),
  memberId: uuid('member_id').notNull(),
  cohortId: uuid('cohort_id').notNull(),
  councilRank: text('council_rank').$type<'president' | 'vice_president'>(),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at'),
})

export const department = pgTable('department', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('department'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<'finance'>(),
})

export const departmentMembership = pgTable('department_membership', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('department_membership'),
  memberId: uuid('member_id').notNull(),
  departmentId: uuid('department_id').notNull(),
  cohortId: uuid('cohort_id').notNull(),
  departmentRank: text('department_rank').$type<'head' | 'vice_head'>(),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at'),
})

export const auditBody = pgTable('audit_body', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('audit_body'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
})

export const votingBody = pgTable('voting_body', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('voting_body'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
})

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
  studentId: text('student_id').notNull(),
  paidFrom: day('paid_from').notNull(),
  paidUntil: day('paid_until').notNull(),
})

// 일
export const task = pgTable('task', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('task'),
  title: text('title').notNull(),
  body: text('body'),
  dueAt: at('due_at'),
  status: text('status').notNull(),
  recurrence: text('recurrence'),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
  assigneeId: uuid('assignee_id'),
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

// 기록
export const chatRoom = pgTable('chat_room', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('chat_room'),
  type: text('type').notNull(),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
})

export const roomMembership = pgTable(
  'room_membership',
  {
    roomId: uuid('room_id').notNull(),
    memberId: uuid('member_id').notNull(),
    joinedAt: at('joined_at').notNull(),
    lastReadAt: at('last_read_at'),
  },
  table => [primaryKey({ columns: [table.roomId, table.memberId] })],
)

export const message = pgTable('message', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('message'),
  roomId: uuid('room_id').notNull(),
  body: text('body').notNull(),
  sentAt: at('sent_at').notNull(),
  isNotice: boolean('is_notice').notNull().default(false),
})

export const file = pgTable('file', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('file'),
  name: text('name').notNull(),
  mediaType: text('media_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  storageKey: text('storage_key').notNull(),
  attachedToId: uuid('attached_to_id'),
})

export const approval = pgTable('approval', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('approval'),
  targetId: uuid('target_id').notNull(),
  targetKind: text('target_kind').notNull(),
  outcome: text('outcome').notNull(),
  actorId: uuid('actor_id').notNull(),
  actorKind: text('actor_kind').notNull(),
  actedAt: at('acted_at').notNull(),
  reason: text('reason'),
})

export const decision = pgTable('decision', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('decision'),
  content: text('content').notNull(),
  rationale: text('rationale'),
  decidedBy: uuid('decided_by').notNull(),
  decidedAt: at('decided_at').notNull(),
  originId: uuid('origin_id'),
  originKind: text('origin_kind'),
})

export const evidenceLink = pgTable(
  'evidence_link',
  {
    recordId: uuid('record_id').notNull(),
    messageId: uuid('message_id').notNull(),
  },
  table => [primaryKey({ columns: [table.recordId, table.messageId] })],
)

export const document = pgTable('document', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('document'),
  title: text('title').notNull(),
  type: text('type').notNull(),
  body: text('body'),
})

export const documentLink = pgTable(
  'document_link',
  {
    documentId: uuid('document_id').notNull(),
    recordId: uuid('record_id').notNull(),
  },
  table => [primaryKey({ columns: [table.documentId, table.recordId] })],
)

export const draftItem = pgTable('draft_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('draft_item'),
  recordId: uuid('record_id').notNull(),
  position: integer('position').notNull(),
  content: text('content').notNull(),
  needsCheck: boolean('needs_check').notNull().default(false),
})

export const source = pgTable('source', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('source'),
  draftItemId: uuid('draft_item_id').notNull(),
  originId: uuid('origin_id').notNull(),
  originKind: text('origin_kind').notNull(),
  location: text('location').notNull(),
})

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('notification'),
  recipientId: uuid('recipient_id').notNull(),
  recordId: uuid('record_id').notNull(),
  type: text('type').notNull(),
  notifiedAt: at('notified_at').notNull(),
  readAt: at('read_at'),
})

// 설계 밖 표 3개(바탕 spec)
export const memberLogin = pgTable('member_login', {
  memberId: uuid('member_id').primaryKey(),
  userId: text('user_id').notNull(),
  linkedAt: at('linked_at').notNull().defaultNow(),
})

export const inviteCode = pgTable('invite_code', {
  councilId: uuid('council_id').primaryKey(),
  code: text('code').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
})

export const pushDevice = pgTable('push_device', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  expirationTime: at('expiration_time'),
  createdAt: at('created_at').notNull().defaultNow(),
})
