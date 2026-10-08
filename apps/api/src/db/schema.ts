import { sql } from 'drizzle-orm'
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'

// Better Auth의 사용자 필드. 학생회 소속과 권한은 memberships에서 관리한다.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique('accounts_provider_account_unique').on(table.providerId, table.accountId),
  index('accounts_user_id_idx').on(table.userId),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
])

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('verifications_identifier_idx').on(table.identifier),
])

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // 초대 링크(/join/코드)와 직접 입력에 같이 쓰는 8자리 코드. 0009 마이그레이션의 DB 함수가 만든다.
  inviteCode: text('invite_code').notNull().default(sql`vada_invite_code()`),
}, (table) => [
  unique('organizations_invite_code_unique').on(table.inviteCode),
  check('organizations_invite_code_format', sql`${table.inviteCode} ~ '^[2-9A-HJ-NP-Z]{8}$'`),
  check('organizations_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('organizations_name_length', sql`char_length(${table.name}) <= 50`),
])

// 생성 시 학생회 소속 검사는 서버에서 수행한다. 생성 기록은 소속 변경과 독립적이다.
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('events_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('events_name_length', sql`char_length(${table.name}) <= 100`),
  index('events_organization_id_idx').on(table.organizationId),
  unique('events_organization_id_unique').on(table.organizationId, table.id),
])

export const chatRooms = pgTable('chat_rooms', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  eventId: text('event_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'chat_rooms_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  index('chat_rooms_organization_id_idx').on(table.organizationId),
])

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  chatRoomId: text('chat_room_id').notNull()
    .references(() => chatRooms.id, { onDelete: 'restrict' }),
  authorId: text('author_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('messages_content_not_blank', sql`${table.content} ~ '[^[:space:]]'`),
  check('messages_content_length', sql`char_length(${table.content}) <= 2000`),
  index('messages_room_created_id_idx').on(table.chatRoomId, table.createdAt, table.id),
])

export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  handlesFinance: boolean('handles_finance').notNull().default(false),
  // 학생회를 이끄는 자리(회장단). 학생회마다 하나이고, 조직 관리와 구매 승인을 한다.
  isLeadership: boolean('is_leadership').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // 소속의 복합 외래 키가 학생회와 부서를 함께 참조한다.
  unique('departments_organization_id_unique').on(table.organizationId, table.id),
  uniqueIndex('departments_one_leadership').on(table.organizationId).where(sql`${table.isLeadership}`),
  // 회장단은 늘 구매를 승인하므로 구매 승인 표시를 따로 두지 않는다.
  check('departments_leadership_not_finance', sql`NOT (${table.isLeadership} AND ${table.handlesFinance})`),
  // 같은 학생회 안에서 부서 이름이 겹치면 고르는 칸에서 구분할 수 없다.
  unique('departments_organization_name_unique').on(table.organizationId, table.name),
  check('departments_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('departments_name_length', sql`char_length(${table.name}) <= 20`),
])

export const memberships = pgTable('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  // 초대로 들어온 구성원은 부서가 없다(미배정). 회장단이 배정한다.
  departmentId: text('department_id'),
  // 표시용 직책(회장, 국장, 총무 등). 권한과 무관하고 부서를 옮기면 지운다.
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('memberships_organization_user_unique').on(table.organizationId, table.userId),
  foreignKey({
    name: 'memberships_department_same_organization',
    columns: [table.organizationId, table.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  }).onDelete('restrict'),
  check('memberships_title_not_blank', sql`${table.title} ~ '[^[:space:]]'`),
  check('memberships_title_length', sql`char_length(${table.title}) <= 20`),
])

// 끼룩이 한 번의 생성. 같은 키로 다시 보내면 만든 품목을 그대로 돌려준다.
export const purchaseGenerations = pgTable('purchase_generations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  requesterId: text('requester_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  idempotencyKey: text('idempotency_key').notNull(),
  links: jsonb('links').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'purchase_generations_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('purchase_generations_requester_key_unique').on(table.requesterId, table.idempotencyKey),
  unique('purchase_generations_organization_id_unique').on(table.organizationId, table.id),
  check('purchase_generations_key_not_blank', sql`${table.idempotencyKey} ~ '[^[:space:]]'`),
  check('purchase_generations_key_length', sql`char_length(${table.idempotencyKey}) <= 128`),
  check('purchase_generations_links_array', sql`jsonb_typeof(${table.links}) = 'array'`),
])

// 같이 제출한 품목의 묶음. 상태는 없고, 제출할 때의 요청자 부서를 남긴다.
export const purchaseSubmissions = pgTable('purchase_submissions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  requesterId: text('requester_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  // 요청자가 미배정이면 비어 있다.
  departmentId: text('department_id'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'purchase_submissions_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_submissions_department_same_organization',
    columns: [table.organizationId, table.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  }).onDelete('restrict'),
  unique('purchase_submissions_organization_id_unique').on(table.organizationId, table.id),
])

// coupang_products.items의 한 옵션. 조회 응답에서 검사를 통과한 값만 저장한다.
export interface CoupangItem {
  itemId: string | null
  vendorItemId: string | null
  name: string
  price: number | null
  listPrice: number | null
  discountPercent: number | null
  inStock: boolean | null
  deliveryEta: string | null
  imageUrl: string | null
}

// 쿠팡 상품 정보. 학생회와 무관한 공개 정보라 학생회끼리 같이 쓴다. 상품 ID 하나에 옵션 전체를 저장한다.
// pending은 조회 대기열이다. 실행기가 locked_until로 잠그고 가져가며, 실패하면 next_attempt_at에 다시 시도한다.
export const coupangProducts = pgTable('coupang_products', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['pending', 'ready', 'failed'] }).notNull().default('pending'),
  items: jsonb('items').$type<CoupangItem[]>().notNull().default([]),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  errorCode: text('error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  check('coupang_products_id_digits', sql`${table.id} ~ '^[0-9]{1,20}$'`),
  check('coupang_products_status_valid', sql`${table.status} IN ('pending','ready','failed')`),
  check('coupang_products_items_array', sql`jsonb_typeof(${table.items}) = 'array' AND jsonb_array_length(${table.items}) <= 100`),
  check('coupang_products_ready_fetched', sql`${table.status} <> 'ready' OR ${table.fetchedAt} IS NOT NULL`),
  check('coupang_products_attempts_nonnegative', sql`${table.attempts} >= 0`),
  check('coupang_products_error_code', sql`${table.errorCode} ~ '^[A-Z_]{1,40}$'`),
  index('coupang_products_due_idx').on(table.nextAttemptAt).where(sql`${table.status} = 'pending'`),
])

// 행사 대화에 올라온 쿠팡 링크. 같은 상품·판매 옵션은 행사에 하나다. vendor_item_id가 없으면 상품마다 "옵션 미정" 하나다.
export const purchaseCandidates = pgTable('purchase_candidates', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  productId: text('product_id').notNull().references(() => coupangProducts.id, { onDelete: 'restrict' }),
  itemId: text('item_id'),
  vendorItemId: text('vendor_item_id'),
  url: text('url').notNull(),
  hiddenBy: text('hidden_by').references(() => users.id, { onDelete: 'restrict' }),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'purchase_candidates_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('purchase_candidates_organization_id_unique').on(table.organizationId, table.id),
  unique('purchase_candidates_event_product_vendor_unique').on(table.eventId, table.productId, table.vendorItemId).nullsNotDistinct(),
  check('purchase_candidates_item_digits', sql`${table.itemId} ~ '^[0-9]{1,20}$'`),
  check('purchase_candidates_vendor_digits', sql`${table.vendorItemId} ~ '^[0-9]{1,20}$'`),
  check('purchase_candidates_url', sql`${table.url} LIKE 'https://www.coupang.com/vp/products/%' AND char_length(${table.url}) <= 200`),
  check('purchase_candidates_hidden_pair', sql`(${table.hiddenAt} IS NULL) = (${table.hiddenBy} IS NULL)`),
])

// 구매의 진행 단위. 작성 중이면 제출 기록이 없고, 승인·반려하면 결정한 사람이 남는다.
export const purchaseItems = pgTable('purchase_items', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  requesterId: text('requester_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  generationId: text('generation_id'),
  submissionId: text('submission_id'),
  // 후보에서 담은 품목만 있다. 다시 담기로 만든 품목도 원래 후보를 이어 받는다.
  candidateId: text('candidate_id'),
  status: text('status', { enum: ['draft', 'pending', 'approved', 'rejected', 'cancelled'] }).notNull().default('draft'),
  productUrl: text('product_url').notNull(),
  productName: text('product_name'),
  selectedOption: text('selected_option'),
  // null: 옵션 필요 여부 미확인. 수량과 비용 역시 미확인은 null이며 0으로 대체하지 않는다.
  optionRequired: boolean('option_required'),
  quantity: integer('quantity'),
  packagingUnit: text('packaging_unit'),
  estimatedUnitPrice: integer('estimated_unit_price'),
  // 조회한 상품 정보는 편집값과 분리한다. 원본 보존과 가격 매핑은 서버에서 수행한다.
  productSnapshot: jsonb('product_snapshot').$type<Record<string, unknown>>(),
  productFetchedAt: timestamp('product_fetched_at', { withTimezone: true }),
  note: text('note'),
  // 비어 있으면 "상관없음"이다.
  neededBy: date('needed_by'),
  warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
  version: integer('version').notNull().default(1),
  decidedBy: text('decided_by').references(() => users.id, { onDelete: 'restrict' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionReason: text('decision_reason'),
  purchasedBy: text('purchased_by').references(() => users.id, { onDelete: 'restrict' }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }),
  receivedBy: text('received_by').references(() => users.id, { onDelete: 'restrict' }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique('purchase_items_organization_id_unique').on(table.organizationId, table.id),
  foreignKey({
    name: 'purchase_items_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_items_generation_same_organization',
    columns: [table.organizationId, table.generationId],
    foreignColumns: [purchaseGenerations.organizationId, purchaseGenerations.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_items_submission_same_organization',
    columns: [table.organizationId, table.submissionId],
    foreignColumns: [purchaseSubmissions.organizationId, purchaseSubmissions.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_items_candidate_same_organization',
    columns: [table.organizationId, table.candidateId],
    foreignColumns: [purchaseCandidates.organizationId, purchaseCandidates.id],
  }).onDelete('restrict'),
  check('purchase_items_url_not_blank', sql`${table.productUrl} ~ '[^[:space:]]'`),
  check('purchase_items_product_name_not_blank', sql`${table.productName} ~ '[^[:space:]]'`),
  check('purchase_items_product_name_length', sql`char_length(${table.productName}) <= 500`),
  check('purchase_items_selected_option_not_blank', sql`${table.selectedOption} ~ '[^[:space:]]'`),
  check('purchase_items_selected_option_length', sql`char_length(${table.selectedOption}) <= 200`),
  check('purchase_items_packaging_unit_not_blank', sql`${table.packagingUnit} ~ '[^[:space:]]'`),
  check('purchase_items_packaging_unit_length', sql`char_length(${table.packagingUnit}) <= 50`),
  check('purchase_items_quantity_positive', sql`${table.quantity} > 0`),
  check('purchase_items_price_nonnegative', sql`${table.estimatedUnitPrice} >= 0`),
  check('purchase_items_snapshot_object', sql`jsonb_typeof(${table.productSnapshot}) = 'object'`),
  check('purchase_items_snapshot_timestamp_pair', sql`(${table.productSnapshot} IS NULL) = (${table.productFetchedAt} IS NULL)`),
  check('purchase_items_status_valid', sql`${table.status} IN ('draft','pending','approved','rejected','cancelled')`),
  check('purchase_items_draft_unsubmitted', sql`(${table.status} = 'draft') = (${table.submissionId} IS NULL)`),
  check('purchase_items_decision_pair', sql`(${table.decidedAt} IS NULL) = (${table.decidedBy} IS NULL)`),
  check('purchase_items_decided_status', sql`(${table.status} IN ('approved','rejected')) = (${table.decidedAt} IS NOT NULL)`),
  check('purchase_items_rejection_reason', sql`(${table.status} = 'rejected') = (${table.decisionReason} IS NOT NULL)`),
  check('purchase_items_reason_not_blank', sql`${table.decisionReason} ~ '[^[:space:]]'`),
  check('purchase_items_reason_length', sql`char_length(${table.decisionReason}) <= 500`),
  check('purchase_items_note_not_blank', sql`${table.note} ~ '[^[:space:]]'`),
  check('purchase_items_note_length', sql`char_length(${table.note}) <= 200`),
  check('purchase_items_warnings_array', sql`jsonb_typeof(${table.warnings}) = 'array'`),
  check('purchase_items_version_positive', sql`${table.version} > 0`),
  check('purchase_items_purchase_pair', sql`(${table.purchasedAt} IS NULL) = (${table.purchasedBy} IS NULL)`),
  check('purchase_items_purchase_approved', sql`${table.purchasedAt} IS NULL OR ${table.status} = 'approved'`),
  check('purchase_items_receipt_pair', sql`(${table.receivedAt} IS NULL) = (${table.receivedBy} IS NULL)`),
  check('purchase_items_receipt_purchased', sql`${table.receivedAt} IS NULL OR ${table.purchasedAt} IS NOT NULL`),
  index('purchase_items_event_created_idx').on(table.eventId, table.createdAt, table.id),
  index('purchase_items_organization_status_idx').on(table.organizationId, table.status),
  index('purchase_items_candidate_idx').on(table.organizationId, table.candidateId),
])

// 제출 이후의 품목 변화. 고치거나 지우지 않는다. 동작 목록은 contracts의 PURCHASE_ITEM_ACTIONS와 같다.
export const purchaseItemEvents = pgTable('purchase_item_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  itemId: text('item_id').notNull(),
  actorId: text('actor_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['submitted', 'approved', 'rejected', 'cancelled', 'approval_revoked', 'needed_by_changed',
    'purchased', 'purchase_undone', 'received', 'receipt_undone', 're_added'] }).notNull(),
  reason: text('reason'),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  // 한 번에 처리한 제출·결정을 묶는다.
  batchId: text('batch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'purchase_item_events_item_same_organization',
    columns: [table.organizationId, table.itemId],
    foreignColumns: [purchaseItems.organizationId, purchaseItems.id],
  }).onDelete('restrict'),
  check('purchase_item_events_action_valid', sql`${table.action} IN ('submitted','approved','rejected','cancelled','approval_revoked','needed_by_changed','purchased','purchase_undone','received','receipt_undone','re_added')`),
  check('purchase_item_events_reason', sql`(${table.action} = 'rejected') = (${table.reason} IS NOT NULL)`),
  check('purchase_item_events_reason_not_blank', sql`${table.reason} ~ '[^[:space:]]'`),
  check('purchase_item_events_reason_length', sql`char_length(${table.reason}) <= 500`),
  check('purchase_item_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  index('purchase_item_events_item_idx').on(table.itemId, table.createdAt),
])

// 끼룩이가 품목을 만들 때 근거로 쓴 대화. 같은 행사방인지는 생성 API가 검사한다.
export const purchaseItemSources = pgTable('purchase_item_sources', {
  itemId: text('item_id').notNull()
    .references(() => purchaseItems.id, { onDelete: 'restrict' }),
  messageId: text('message_id').notNull()
    .references(() => messages.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.messageId] }),
])

// 후보를 공유한 메시지. 한 메시지의 링크 순서(0~9)마다 한 줄이다. 같은 행사방인지는 대화 저장이 보장한다.
export const purchaseCandidateShares = pgTable('purchase_candidate_shares', {
  organizationId: text('organization_id').notNull(),
  candidateId: text('candidate_id').notNull(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.position] }),
  foreignKey({
    name: 'purchase_candidate_shares_candidate_same_organization',
    columns: [table.organizationId, table.candidateId],
    foreignColumns: [purchaseCandidates.organizationId, purchaseCandidates.id],
  }).onDelete('restrict'),
  check('purchase_candidate_shares_position', sql`${table.position} >= 0 AND ${table.position} < 10`),
  index('purchase_candidate_shares_candidate_idx').on(table.candidateId, table.createdAt),
])

// 승인 상태와 독립적인 배송 상태. 외부 조회 성공 시각과 배송 이벤트 시각을 구분한다.
export const shipments = pgTable('shipments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  carrierId: text('carrier_id').notNull(),
  trackingNumber: text('tracking_number').notNull(),
  status: text('status', { enum: ['unknown', 'pending', 'in_transit', 'delivered', 'exception'] }).notNull().default('unknown'),
  providerStatus: text('provider_status'),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  trackingActive: boolean('tracking_active').notNull().default(true),
  trackingVersion: integer('tracking_version').notNull().default(1),
  webhookExpiresAt: timestamp('webhook_expires_at', { withTimezone: true }),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  unique('shipments_organization_id_unique').on(table.organizationId, table.id),
  unique('shipments_organization_carrier_number_unique').on(table.organizationId, table.carrierId, table.trackingNumber),
  check('shipments_carrier_not_blank', sql`${table.carrierId} ~ '[^[:space:]]'`),
  check('shipments_number_not_blank', sql`${table.trackingNumber} ~ '[^[:space:]]'`),
  check('shipments_status_valid', sql`${table.status} IN ('unknown','pending','in_transit','delivered','exception')`),
  check('shipments_tracking_version_positive', sql`${table.trackingVersion} > 0`),
  index('shipments_renewal_idx').on(table.webhookExpiresAt, table.id).where(sql`${table.trackingActive} = true`),
])

// 이력 보존을 위해 연결별 ID를 둔다. 재연결은 기존 행을 덮어쓰지 않고 새 행을 만든다.
export const shipmentItems = pgTable('shipment_items', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull(),
  purchaseItemId: text('purchase_item_id').notNull(),
  organizationId: text('organization_id').notNull(),
  linkedBy: text('linked_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  unlinkedBy: text('unlinked_by').references(() => users.id, { onDelete: 'restrict' }),
  unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
}, table => [
  foreignKey({ name: 'shipment_items_shipment_same_organization', columns: [table.organizationId, table.shipmentId], foreignColumns: [shipments.organizationId, shipments.id] }).onDelete('restrict'),
  foreignKey({ name: 'shipment_items_item_same_organization', columns: [table.organizationId, table.purchaseItemId], foreignColumns: [purchaseItems.organizationId, purchaseItems.id] }).onDelete('restrict'),
  uniqueIndex('shipment_items_active_pair_unique').on(table.shipmentId, table.purchaseItemId).where(sql`${table.unlinkedAt} IS NULL`),
  // 품목별 송장 조회와 위 FK 검사가 같이 쓴다.
  index('shipment_items_item_idx').on(table.organizationId, table.purchaseItemId),
  check('shipment_items_unlink_pair', sql`(${table.unlinkedAt} IS NULL) = (${table.unlinkedBy} IS NULL)`),
  check('shipment_items_unlink_time', sql`${table.unlinkedAt} >= ${table.linkedAt}`),
])

// 작업은 DB에 보존한다. worker가 만료 잠금 회수·재시도·중복 알림 병합을 담당한다.
export const shipmentJobs = pgTable('shipment_jobs', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'restrict' }),
  kind: text('kind', { enum: ['register', 'refresh', 'unregister'] }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check('shipment_jobs_kind_valid', sql`${table.kind} IN ('register','refresh','unregister')`),
  check('shipment_jobs_status_valid', sql`${table.status} IN ('pending','running','completed','failed')`),
  check('shipment_jobs_attempts_nonnegative', sql`${table.attempts} >= 0`),
  check('shipment_jobs_running_lease', sql`(${table.status} = 'running') = (${table.lockedUntil} IS NOT NULL)`),
  // 실행 중 알림은 다음 대기 작업 하나로 합친다. 진행 중 작업과 대기 작업은 공존 가능하다.
  uniqueIndex('shipment_jobs_pending_unique').on(table.shipmentId, table.kind).where(sql`${table.status} = 'pending'`),
  uniqueIndex('shipment_jobs_running_unique').on(table.shipmentId, table.kind).where(sql`${table.status} = 'running'`),
  index('shipment_jobs_due_idx').on(table.runAfter, table.id).where(sql`${table.status} = 'pending'`),
  index('shipment_jobs_lease_idx').on(table.lockedUntil, table.id).where(sql`${table.status} = 'running'`),
])

// 연결 해제 뒤 도착한 과거 등록 재시도가 재연결을 만들지 않도록 결과를 보존한다.
export const shipmentRegistrations = pgTable('shipment_registrations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  idempotencyKey: text('idempotency_key').notNull(),
  inputHash: text('input_hash').notNull(),
  shipmentId: text('shipment_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('shipment_registrations_actor_key_unique').on(table.organizationId, table.actorId, table.idempotencyKey),
  foreignKey({ name: 'shipment_registrations_same_organization', columns: [table.organizationId, table.shipmentId], foreignColumns: [shipments.organizationId, shipments.id] }).onDelete('restrict'),
  check('shipment_registrations_key_not_blank', sql`${table.idempotencyKey} ~ '[^[:space:]]'`),
  check('shipment_registrations_hash_valid', sql`${table.inputHash} ~ '^[a-f0-9]{64}$'`),
])
