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
  // 한국 시각으로 받은 시작·끝 일시와 장소(M3a). 끝은 시작이 있어야 하고 시작보다 늦다.
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  place: text('place'),
  version: integer('version').notNull().default(1),
}, (table) => [
  check('events_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('events_name_length', sql`char_length(${table.name}) <= 100`),
  check('events_ends_after_start', sql`${table.endsAt} IS NULL OR (${table.startsAt} IS NOT NULL AND ${table.endsAt} > ${table.startsAt})`),
  check('events_time_range', sql`(${table.startsAt} IS NULL OR ${table.startsAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND (${table.endsAt} IS NULL OR ${table.endsAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')`),
  check('events_place_not_blank', sql`${table.place} ~ '[^[:space:]]'`),
  check('events_place_length', sql`char_length(${table.place}) <= 100`),
  check('events_version_positive', sql`${table.version} >= 1`),
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
// 회계 기간. 같은 학생회의 기간은 날짜가 겹치지 않는다. 겹침은 서버가 학생회 단위 잠금 안에서 확인한다.
// DB 제약(exclusion)은 btree_gist 확장이 있어야 해서 쓰지 않는다.
export const budgetPeriods = pgTable('budget_periods', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  // 마감한 때와 사람(M2-3c). 둘이 함께 있거나 함께 없다.
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: text('closed_by').references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique('budget_periods_organization_id_unique').on(table.organizationId, table.id),
  check('budget_periods_closed_pair', sql`(${table.closedAt} IS NULL) = (${table.closedBy} IS NULL)`),
  unique('budget_periods_organization_name_unique').on(table.organizationId, table.name),
  check('budget_periods_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('budget_periods_name_length', sql`char_length(${table.name}) <= 30`),
  check('budget_periods_dates_range', sql`${table.startsOn} >= '2000-01-01' AND ${table.endsOn} <= '2999-12-31'`),
  check('budget_periods_dates_order', sql`${table.startsOn} <= ${table.endsOn}`),
  check('budget_periods_version_positive', sql`${table.version} >= 1`),
  index('budget_periods_organization_starts_idx').on(table.organizationId, table.startsOn),
])

// 편성의 한 줄. 수입·운영 줄은 이름과 금액이 있고, 행사 줄은 행사만 가리킨다. 행사 줄의 금액은 event_finances.budget에 있다.
export const budgetLines = pgTable('budget_lines', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  periodId: text('period_id').notNull(),
  kind: text('kind', { enum: ['income', 'event', 'operating'] }).notNull(),
  eventId: text('event_id'),
  name: text('name'),
  amount: integer('amount'),
  // 묶음(kind) 안 화면 순서
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'budget_lines_period_same_organization',
    columns: [table.organizationId, table.periodId],
    foreignColumns: [budgetPeriods.organizationId, budgetPeriods.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'budget_lines_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('budget_lines_organization_id_unique').on(table.organizationId, table.id),
  // 행사는 한 기간에만 들어간다.
  unique('budget_lines_event_unique').on(table.eventId),
  check('budget_lines_kind_valid', sql`${table.kind} IN ('income','event','operating')`),
  check('budget_lines_event_kind', sql`(${table.kind} = 'event') = (${table.eventId} IS NOT NULL)`),
  check('budget_lines_named_kind', sql`(${table.kind} = 'event') = (${table.name} IS NULL)`),
  check('budget_lines_amount_kind', sql`(${table.kind} = 'event') = (${table.amount} IS NULL)`),
  check('budget_lines_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('budget_lines_name_length', sql`char_length(${table.name}) <= 30`),
  check('budget_lines_amount_nonnegative', sql`${table.amount} >= 0`),
  check('budget_lines_position_nonnegative', sql`${table.position} >= 0`),
  index('budget_lines_period_idx').on(table.periodId, table.kind, table.position),
])

// 기간·편성 처리 기록. 고치거나 지우지 않는다.
export const budgetPeriodEvents = pgTable('budget_period_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  periodId: text('period_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['created', 'updated', 'closed', 'reopened'] }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  // 마감을 다시 열 때만 있다.
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'budget_period_events_period_same_organization',
    columns: [table.organizationId, table.periodId],
    foreignColumns: [budgetPeriods.organizationId, budgetPeriods.id],
  }).onDelete('restrict'),
  check('budget_period_events_action_valid', sql`${table.action} IN ('created','updated','closed','reopened')`),
  check('budget_period_events_reason_when_reopened', sql`(${table.action} = 'reopened') = (${table.reason} IS NOT NULL)`),
  check('budget_period_events_reason_not_blank', sql`${table.reason} ~ '[^[:space:]]'`),
  check('budget_period_events_reason_length', sql`char_length(${table.reason}) <= 200`),
  check('budget_period_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  index('budget_period_events_period_idx').on(table.periodId, table.createdAt),
])

// 결제 한 번(영수증 한 장 단위)의 지출. 지우지 않고 취소로 남긴다(2026-10-09 결정).
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  // 비어 있으면 상시 운영 지출이다.
  eventId: text('event_id'),
  // 상시 운영 지출의 운영 항목. 운영 줄인지, 결제일이 그 줄의 기간 안인지는 서버가 확인한다.
  budgetLineId: text('budget_line_id'),
  vendor: text('vendor').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  paidOn: date('paid_on').notNull(),
  method: text('method', { enum: ['council_card', 'transfer', 'cash', 'personal'] }).notNull(),
  payerId: text('payer_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  note: text('note'),
  recordedBy: text('recorded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'expenses_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('expenses_organization_id_unique').on(table.organizationId, table.id),
  check('expenses_vendor_not_blank', sql`${table.vendor} ~ '[^[:space:]]'`),
  check('expenses_vendor_length', sql`char_length(${table.vendor}) <= 100`),
  check('expenses_description_not_blank', sql`${table.description} ~ '[^[:space:]]'`),
  check('expenses_description_length', sql`char_length(${table.description}) <= 200`),
  check('expenses_amount_nonnegative', sql`${table.amount} >= 0`),
  check('expenses_paid_on_range', sql`${table.paidOn} BETWEEN '2000-01-01' AND '2999-12-31'`),
  check('expenses_method_valid', sql`${table.method} IN ('council_card','transfer','cash','personal')`),
  check('expenses_note_not_blank', sql`${table.note} ~ '[^[:space:]]'`),
  check('expenses_note_length', sql`char_length(${table.note}) <= 200`),
  check('expenses_version_positive', sql`${table.version} >= 1`),
  check('expenses_void_triple', sql`(${table.voidedAt} IS NULL) = (${table.voidedBy} IS NULL) AND (${table.voidedAt} IS NULL) = (${table.voidReason} IS NULL)`),
  check('expenses_void_reason_not_blank', sql`${table.voidReason} ~ '[^[:space:]]'`),
  check('expenses_void_reason_length', sql`char_length(${table.voidReason}) <= 200`),
  index('expenses_organization_paid_idx').on(table.organizationId, table.paidOn.desc(), table.createdAt.desc()),
  foreignKey({
    name: 'expenses_budget_line_same_organization',
    columns: [table.organizationId, table.budgetLineId],
    foreignColumns: [budgetLines.organizationId, budgetLines.id],
  }).onDelete('restrict'),
  // 행사 지출은 그 행사 줄로 세므로 운영 항목이 없다.
  check('expenses_budget_line_operating_only', sql`${table.budgetLineId} IS NULL OR ${table.eventId} IS NULL`),
  index('expenses_budget_line_idx').on(table.organizationId, table.budgetLineId),
])

// 지출에 연결한 승인 품목. 품목 하나는 지출 하나에만 연결된다.
export const expenseItems = pgTable('expense_items', {
  purchaseItemId: text('purchase_item_id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  expenseId: text('expense_id').notNull(),
}, (table) => [
  foreignKey({
    name: 'expense_items_expense_same_organization',
    columns: [table.organizationId, table.expenseId],
    foreignColumns: [expenses.organizationId, expenses.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'expense_items_item_same_organization',
    columns: [table.organizationId, table.purchaseItemId],
    foreignColumns: [purchaseItems.organizationId, purchaseItems.id],
  }).onDelete('restrict'),
  index('expense_items_expense_idx').on(table.organizationId, table.expenseId),
])

// 증빙 파일. 파일은 R2에 두고 경로만 저장한다. 다 올라가 확인된 파일만 ready다.
export const expenseReceipts = pgTable('expense_receipts', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  expenseId: text('expense_id').notNull(),
  objectKey: text('object_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  kind: text('kind', { enum: ['receipt', 'statement', 'tax_invoice', 'other'] }).notNull(),
  status: text('status', { enum: ['pending', 'ready'] }).notNull().default('pending'),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
}, (table) => [
  foreignKey({
    name: 'expense_receipts_expense_same_organization',
    columns: [table.organizationId, table.expenseId],
    foreignColumns: [expenses.organizationId, expenses.id],
  }).onDelete('restrict'),
  check('expense_receipts_object_key_length', sql`char_length(${table.objectKey}) <= 300`),
  check('expense_receipts_file_name_not_blank', sql`${table.fileName} ~ '[^[:space:]]'`),
  check('expense_receipts_file_name_length', sql`char_length(${table.fileName}) <= 200`),
  check('expense_receipts_content_type_valid', sql`${table.contentType} IN ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')`),
  check('expense_receipts_size_range', sql`${table.sizeBytes} BETWEEN 1 AND 10485760`),
  check('expense_receipts_kind_valid', sql`${table.kind} IN ('receipt','statement','tax_invoice','other')`),
  check('expense_receipts_status_valid', sql`${table.status} IN ('pending','ready')`),
  check('expense_receipts_ready_confirmed', sql`(${table.status} = 'ready') = (${table.confirmedAt} IS NOT NULL)`),
  index('expense_receipts_expense_idx').on(table.organizationId, table.expenseId),
])

// 지출 처리 기록. 고치거나 지우지 않는다.
export const expenseEvents = pgTable('expense_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  expenseId: text('expense_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['created', 'updated', 'voided', 'receipt_added', 'receipt_removed'] }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'expense_events_expense_same_organization',
    columns: [table.organizationId, table.expenseId],
    foreignColumns: [expenses.organizationId, expenses.id],
  }).onDelete('restrict'),
  check('expense_events_action_valid', sql`${table.action} IN ('created','updated','voided','receipt_added','receipt_removed')`),
  check('expense_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  index('expense_events_expense_idx').on(table.expenseId, table.createdAt),
])

// 행사의 예산과 정산 상태. 예산을 정하거나 정산할 때 생긴다. 행이 없으면 예산 미정·정산 전이다.
export const eventFinances = pgTable('event_finances', {
  eventId: text('event_id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  // 비어 있으면 예산 미정이다.
  budget: integer('budget'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  settledBy: text('settled_by').references(() => users.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'event_finances_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  check('event_finances_budget_nonnegative', sql`${table.budget} >= 0`),
  check('event_finances_settled_pair', sql`(${table.settledAt} IS NULL) = (${table.settledBy} IS NULL)`),
  check('event_finances_version_positive', sql`${table.version} >= 1`),
])

// 예산·정산 처리 기록. 고치거나 지우지 않는다.
export const eventFinanceEvents = pgTable('event_finance_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['budget_set', 'settled', 'reopened'] }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  // 다시 열 때만 사유가 있다.
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'event_finance_events_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  check('event_finance_events_action_valid', sql`${table.action} IN ('budget_set','settled','reopened')`),
  check('event_finance_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  check('event_finance_events_reason_when_reopened', sql`(${table.action} = 'reopened') = (${table.reason} IS NOT NULL)`),
  check('event_finance_events_reason_not_blank', sql`${table.reason} ~ '[^[:space:]]'`),
  check('event_finance_events_reason_length', sql`char_length(${table.reason}) <= 200`),
  index('event_finance_events_event_idx').on(table.eventId, table.createdAt),
])

// 통장에 들어온 돈 한 건(M2-3b). 기간 하나에 속하고, 받은 날은 그 기간 안이다(서버 확인). 지우지 않고 취소로 남긴다.
export const incomes = pgTable('incomes', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  periodId: text('period_id').notNull(),
  // 그 기간의 수입 줄. 수입 줄인지, 같은 기간인지는 서버가 확인한다.
  budgetLineId: text('budget_line_id'),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  receivedOn: date('received_on').notNull(),
  note: text('note'),
  recordedBy: text('recorded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
  voidReason: text('void_reason'),
  // 이월금이면 넘겨준 기간(M2-3c). 이월금은 손으로 고치거나 취소하지 않는다.
  carriedFromPeriodId: text('carried_from_period_id'),
  // 참가비 수입이면 그 행사(M3b-2). 행사 정산이 만들고 다시 열면 취소한다. 손으로 고치거나 취소하지 않는다.
  eventId: text('event_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'incomes_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  // 이월금이면서 참가비 수입일 수 없다.
  check('incomes_single_source', sql`${table.carriedFromPeriodId} IS NULL OR ${table.eventId} IS NULL`),
  // 행사 하나의 취소하지 않은 참가비 수입은 한 건뿐이다.
  uniqueIndex('incomes_event_active_unique').on(table.eventId).where(sql`${table.eventId} IS NOT NULL AND ${table.voidedAt} IS NULL`),
  foreignKey({
    name: 'incomes_carried_from_same_organization',
    columns: [table.organizationId, table.carriedFromPeriodId],
    foreignColumns: [budgetPeriods.organizationId, budgetPeriods.id],
  }).onDelete('restrict'),
  check('incomes_carried_from_other_period', sql`${table.carriedFromPeriodId} <> ${table.periodId}`),
  // 기간 하나가 넘기는 이월금은 취소하지 않은 것이 한 건뿐이다.
  uniqueIndex('incomes_carried_from_active_unique').on(table.carriedFromPeriodId)
    .where(sql`${table.carriedFromPeriodId} IS NOT NULL AND ${table.voidedAt} IS NULL`),
  foreignKey({
    name: 'incomes_period_same_organization',
    columns: [table.organizationId, table.periodId],
    foreignColumns: [budgetPeriods.organizationId, budgetPeriods.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'incomes_budget_line_same_organization',
    columns: [table.organizationId, table.budgetLineId],
    foreignColumns: [budgetLines.organizationId, budgetLines.id],
  }).onDelete('restrict'),
  unique('incomes_organization_id_unique').on(table.organizationId, table.id),
  check('incomes_description_not_blank', sql`${table.description} ~ '[^[:space:]]'`),
  check('incomes_description_length', sql`char_length(${table.description}) <= 100`),
  check('incomes_amount_positive', sql`${table.amount} >= 1`),
  check('incomes_received_on_range', sql`${table.receivedOn} BETWEEN '2000-01-01' AND '2999-12-31'`),
  check('incomes_note_not_blank', sql`${table.note} ~ '[^[:space:]]'`),
  check('incomes_note_length', sql`char_length(${table.note}) <= 200`),
  check('incomes_version_positive', sql`${table.version} >= 1`),
  check('incomes_void_triple', sql`(${table.voidedAt} IS NULL) = (${table.voidedBy} IS NULL) AND (${table.voidedAt} IS NULL) = (${table.voidReason} IS NULL)`),
  check('incomes_void_reason_not_blank', sql`${table.voidReason} ~ '[^[:space:]]'`),
  check('incomes_void_reason_length', sql`char_length(${table.voidReason}) <= 200`),
  index('incomes_period_received_idx').on(table.periodId, table.receivedOn),
  index('incomes_budget_line_idx').on(table.organizationId, table.budgetLineId),
])

// 수입 처리 기록. 고치거나 지우지 않는다.
export const incomeEvents = pgTable('income_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  incomeId: text('income_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['created', 'updated', 'voided'] }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'income_events_income_same_organization',
    columns: [table.organizationId, table.incomeId],
    foreignColumns: [incomes.organizationId, incomes.id],
  }).onDelete('restrict'),
  check('income_events_action_valid', sql`${table.action} IN ('created','updated','voided')`),
  check('income_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  index('income_events_income_idx').on(table.incomeId, table.createdAt),
])

// 행사의 참가 신청 설정(M3a). 행사 하나에 하나이고, 공개 링크 코드는 바뀌지 않는다.
export const registrationForms = pgTable('registration_forms', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  eventId: text('event_id').notNull().unique(),
  // 공개 링크 /apply/{code}. 초대 코드와 같은 형식을 0009의 DB 함수가 만든다.
  code: text('code').notNull().default(sql`vada_invite_code()`),
  // 멈추면 새 신청만 막는다.
  accepting: boolean('accepting').notNull().default(true),
  opensAt: timestamp('opens_at', { withTimezone: true }),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  capacity: integer('capacity'),
  notice: text('notice'),
  collectPhone: boolean('collect_phone').notNull().default(false),
  // 참가비(M3b). 0원이면 무료다.
  fee: integer('fee').notNull().default(0),
  // 학생회비 납부자 참가비. 비어 있으면 납부자를 따로 보지 않는다.
  memberFee: integer('member_fee'),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'registration_forms_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('registration_forms_code_unique').on(table.code),
  unique('registration_forms_organization_id_unique').on(table.organizationId, table.id),
  check('registration_forms_code_format', sql`${table.code} ~ '^[2-9A-HJ-NP-Z]{8}$'`),
  check('registration_forms_opens_before_closes', sql`${table.opensAt} IS NULL OR ${table.opensAt} < ${table.closesAt}`),
  check('registration_forms_time_range', sql`(${table.opensAt} IS NULL OR ${table.opensAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND ${table.closesAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00'`),
  check('registration_forms_capacity_range', sql`${table.capacity} BETWEEN 1 AND 5000`),
  check('registration_forms_notice_not_blank', sql`${table.notice} ~ '[^[:space:]]'`),
  check('registration_forms_notice_length', sql`char_length(${table.notice}) <= 1000`),
  check('registration_forms_version_positive', sql`${table.version} >= 1`),
  check('registration_forms_fee_range', sql`${table.fee} BETWEEN 0 AND 1000000`),
  check('registration_forms_member_fee_range', sql`${table.memberFee} IS NULL OR (${table.memberFee} >= 0 AND ${table.memberFee} < ${table.fee})`),
])

// 참가 신청 한 건. 취소하거나 보관 기간이 지나면 개인 칸을 지우고, 행은 신청 수로 남긴다.
export const registrations = pgTable('registrations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  formId: text('form_id').notNull(),
  // 개인 링크 토큰의 SHA-256. 토큰 자체는 저장하지 않는다.
  tokenHash: text('token_hash').unique(),
  name: text('name'),
  studentId: text('student_id'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  // 운영진이 취소하면 그 사람이고, 신청자가 스스로 취소하면 비어 있다.
  cancelledBy: text('cancelled_by').references(() => users.id, { onDelete: 'restrict' }),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
  // 신청할 때 정한 학생회비 납부 구분(M3b). 납부자 참가비가 없으면 비어 있다. 개인 칸을 지워도 남는다.
  duesMember: boolean('dues_member'),
  // 입금 확인(M3b). 셋이 함께 있거나 함께 없다. 개인 칸을 지워도 남아 받은 돈으로 센다.
  paidAmount: integer('paid_amount'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidBy: text('paid_by').references(() => users.id, { onDelete: 'restrict' }),
  // 참석 확인(M3c). 둘이 함께 있거나 함께 없다. 개인 칸을 지워도 남아 참석 수로 센다. 취소한 신청에는 없다.
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedInBy: text('checked_in_by').references(() => users.id, { onDelete: 'restrict' }),
}, (table) => [
  foreignKey({
    name: 'registrations_form_same_organization',
    columns: [table.organizationId, table.formId],
    foreignColumns: [registrationForms.organizationId, registrationForms.id],
  }).onDelete('restrict'),
  check('registrations_purged_state', sql`(${table.purgedAt} IS NULL AND ${table.tokenHash} IS NOT NULL AND ${table.name} IS NOT NULL
    AND ${table.studentId} IS NOT NULL) OR (${table.purgedAt} IS NOT NULL AND ${table.tokenHash} IS NULL AND ${table.name} IS NULL
    AND ${table.studentId} IS NULL AND ${table.phone} IS NULL)`),
  // 취소하면 바로 개인 칸을 지운다.
  check('registrations_cancel_purges', sql`${table.cancelledAt} IS NULL OR ${table.purgedAt} IS NOT NULL`),
  check('registrations_cancelled_pair', sql`${table.cancelledBy} IS NULL OR ${table.cancelledAt} IS NOT NULL`),
  check('registrations_token_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  check('registrations_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('registrations_name_length', sql`char_length(${table.name}) <= 30`),
  check('registrations_student_id_format', sql`${table.studentId} ~ '^[0-9]{6,12}$'`),
  check('registrations_phone_format', sql`${table.phone} ~ '^01[0-9]{8,9}$'`),
  // 같은 신청에 살아 있는 같은 학번은 하나다. 지운 행은 학번이 없다.
  uniqueIndex('registrations_form_student_active_unique').on(table.formId, table.studentId).where(sql`${table.purgedAt} IS NULL`),
  index('registrations_form_created_idx').on(table.formId, table.createdAt),
  check('registrations_paid_triple', sql`(${table.paidAt} IS NULL) = (${table.paidAmount} IS NULL) AND (${table.paidAt} IS NULL) = (${table.paidBy} IS NULL)`),
  check('registrations_paid_amount_range', sql`${table.paidAmount} BETWEEN 1 AND 1000000`),
  check('registrations_checked_in_pair', sql`(${table.checkedInAt} IS NULL) = (${table.checkedInBy} IS NULL)`),
  check('registrations_cancelled_not_checked_in', sql`${table.cancelledAt} IS NULL OR ${table.checkedInAt} IS NULL`),
])

// 참가비를 받는 학생회 계좌(M3b). 학생회마다 하나이고 재정 담당자가 정한다. 참가비를 받는 신청이 늘 가리키도록 지우지 않는다.
export const feeAccounts = pgTable('fee_accounts', {
  organizationId: text('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'restrict' }),
  bank: text('bank').notNull(),
  accountNumber: text('account_number').notNull(),
  holder: text('holder').notNull(),
  version: integer('version').notNull().default(1),
  updatedBy: text('updated_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  check('fee_accounts_bank_not_blank', sql`${table.bank} ~ '[^[:space:]]'`),
  check('fee_accounts_bank_length', sql`char_length(${table.bank}) <= 20`),
  check('fee_accounts_number_format', sql`${table.accountNumber} ~ '^[0-9]+(-[0-9]+)*$'`),
  check('fee_accounts_number_length', sql`char_length(${table.accountNumber}) <= 30`),
  check('fee_accounts_number_digits', sql`char_length(replace(${table.accountNumber}, '-', '')) BETWEEN 8 AND 20`),
  check('fee_accounts_holder_not_blank', sql`${table.holder} ~ '[^[:space:]]'`),
  check('fee_accounts_holder_length', sql`char_length(${table.holder}) <= 30`),
  check('fee_accounts_version_positive', sql`${table.version} >= 1`),
])

// 계좌를 정하거나 바꾼 기록. 고치거나 지우지 않는다. changes는 { from, to }다.
export const feeAccountEvents = pgTable('fee_account_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: 'fee_account_events_account', columns: [table.organizationId], foreignColumns: [feeAccounts.organizationId] }).onDelete('restrict'),
  check('fee_account_events_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  index('fee_account_events_organization_idx').on(table.organizationId, table.createdAt),
])

// 지금 쓰는 학생회비 납부 명단(M3b). 학생회마다 하나이고, 새로 올리면 통째로 바꾼다. 쓰는 기한이 지나면 지운다.
export const duesRosters = pgTable('dues_rosters', {
  organizationId: text('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'restrict' }),
  label: text('label').notNull(),
  // 이 날(한국 날짜)까지 쓰고 그다음 날 지운다.
  useUntil: date('use_until').notNull(),
  version: integer('version').notNull().default(1),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('dues_rosters_label_not_blank', sql`${table.label} ~ '[^[:space:]]'`),
  check('dues_rosters_label_length', sql`char_length(${table.label}) <= 30`),
  check('dues_rosters_use_until_range', sql`${table.useUntil} BETWEEN '2000-01-01' AND '2999-12-31'`),
  check('dues_rosters_version_positive', sql`${table.version} >= 1`),
])

// 명단의 납부자. 학번과 이름만 둔다.
// 이 FK만 CASCADE다. 명단을 지우는 것이 곧 납부자를 지우는 것이고, 납부자 행은 명단 없이 뜻이 없다.
export const duesMembers = pgTable('dues_members', {
  organizationId: text('organization_id').notNull(),
  studentId: text('student_id').notNull(),
  name: text('name').notNull(),
}, (table) => [
  primaryKey({ name: 'dues_members_pkey', columns: [table.organizationId, table.studentId] }),
  foreignKey({ name: 'dues_members_roster', columns: [table.organizationId], foreignColumns: [duesRosters.organizationId] }).onDelete('cascade'),
  check('dues_members_student_id_format', sql`${table.studentId} ~ '^[0-9]{6,12}$'`),
  check('dues_members_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('dues_members_name_length', sql`char_length(${table.name}) <= 30`),
])
