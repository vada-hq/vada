import { bigint, boolean, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'

import { at } from './schema-columns.js'

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
