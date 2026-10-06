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
})

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // 소속의 복합 외래 키가 학생회와 부서를 함께 참조한다.
  unique('departments_organization_id_unique').on(table.organizationId, table.id),
])

export const memberships = pgTable('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  departmentId: text('department_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('memberships_organization_user_unique').on(table.organizationId, table.userId),
  foreignKey({
    name: 'memberships_department_same_organization',
    columns: [table.organizationId, table.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  }).onDelete('restrict'),
])

// 소속에서 얻은 요청 부서를 기록한다. 권한·상태 전환·제출 필수값 검사는 서버 책임이다.
export const purchaseRequests = pgTable('purchase_requests', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  requesterId: text('requester_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  departmentId: text('department_id').notNull(),
  purpose: text('purpose'),
  neededBy: date('needed_by'),
  estimatedShippingCost: integer('estimated_shipping_cost'),
  status: text('status', { enum: ['draft', 'discarded', 'submitted', 'approved', 'rejected'] }).notNull().default('draft'),
  // 같은 요청자의 재시도 중복 방지. 생성은 요청서·품목·근거·이력을 한 트랜잭션으로 저장한다.
  idempotencyKey: text('idempotency_key').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({
    name: 'purchase_requests_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_requests_department_same_organization',
    columns: [table.organizationId, table.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  }).onDelete('restrict'),
  unique('purchase_requests_requester_key_unique').on(table.requesterId, table.idempotencyKey),
  unique('purchase_requests_organization_id_unique').on(table.organizationId, table.id),
  check('purchase_requests_key_not_blank', sql`${table.idempotencyKey} ~ '[^[:space:]]'`),
  check('purchase_requests_status_valid', sql`${table.status} IN ('draft','discarded','submitted','approved','rejected')`),
  check('purchase_requests_version_positive', sql`${table.version} > 0`),
  check('purchase_requests_shipping_nonnegative', sql`${table.estimatedShippingCost} >= 0`),
  index('purchase_requests_event_created_idx').on(table.eventId, table.createdAt, table.id),
])

export const purchaseItems = pgTable('purchase_items', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull()
    .references(() => purchaseRequests.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('purchase_items_request_position_unique').on(table.requestId, table.position),
  unique('purchase_items_request_id_unique').on(table.requestId, table.id),
  check('purchase_items_position_nonnegative', sql`${table.position} >= 0`),
  check('purchase_items_url_not_blank', sql`${table.productUrl} ~ '[^[:space:]]'`),
  check('purchase_items_quantity_positive', sql`${table.quantity} > 0`),
  check('purchase_items_price_nonnegative', sql`${table.estimatedUnitPrice} >= 0`),
  check('purchase_items_snapshot_object', sql`jsonb_typeof(${table.productSnapshot}) = 'object'`),
  check('purchase_items_snapshot_timestamp_pair', sql`(${table.productSnapshot} IS NULL) = (${table.productFetchedAt} IS NULL)`),
])

// 메시지가 요청서와 같은 행사방에 속하는지는 생성 API에서 검증한다.
export const purchaseRequestSources = pgTable('purchase_request_sources', {
  requestId: text('request_id').notNull()
    .references(() => purchaseRequests.id, { onDelete: 'restrict' }),
  messageId: text('message_id').notNull()
    .references(() => messages.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.requestId, table.messageId] }),
])

// 서버는 변경과 이력 추가를 한 트랜잭션으로 처리하고 이력을 수정·삭제하지 않는다.
export const purchaseRequestHistory = pgTable('purchase_request_history', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull()
    .references(() => purchaseRequests.id, { onDelete: 'restrict' }),
  actorId: text('actor_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: text('action', { enum: ['created', 'updated', 'discarded', 'submitted', 'approved', 'rejected'] }).notNull(),
  version: integer('version').notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('purchase_history_request_version_unique').on(table.requestId, table.version),
  check('purchase_history_action_valid', sql`${table.action} IN ('created','updated','discarded','submitted','approved','rejected')`),
  check('purchase_history_version_positive', sql`${table.version} > 0`),
  check('purchase_history_changes_object', sql`jsonb_typeof(${table.changes}) = 'object'`),
  check('purchase_history_rejection_reason', sql`${table.action} <> 'rejected' OR (${table.reason} IS NOT NULL AND ${table.reason} ~ '[^[:space:]]')`),
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
// requestId는 복합 FK용이다. 같은 학생회의 요청서·품목·배송만 연결한다.
export const shipmentItems = pgTable('shipment_items', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull(),
  purchaseItemId: text('purchase_item_id').notNull(),
  requestId: text('request_id').notNull(),
  organizationId: text('organization_id').notNull(),
  linkedBy: text('linked_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  unlinkedBy: text('unlinked_by').references(() => users.id, { onDelete: 'restrict' }),
  unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
}, table => [
  foreignKey({ name: 'shipment_items_shipment_same_organization', columns: [table.organizationId, table.shipmentId], foreignColumns: [shipments.organizationId, shipments.id] }).onDelete('restrict'),
  foreignKey({ name: 'shipment_items_request_same_organization', columns: [table.organizationId, table.requestId], foreignColumns: [purchaseRequests.organizationId, purchaseRequests.id] }).onDelete('restrict'),
  foreignKey({ name: 'shipment_items_item_same_request', columns: [table.requestId, table.purchaseItemId], foreignColumns: [purchaseItems.requestId, purchaseItems.id] }).onDelete('restrict'),
  uniqueIndex('shipment_items_active_pair_unique').on(table.shipmentId, table.purchaseItemId).where(sql`${table.unlinkedAt} IS NULL`),
  index('shipment_items_request_idx').on(table.requestId, table.purchaseItemId),
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
