import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { at } from './schema-columns.js'

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

// 가입 동의 기록(DEC-51). 로그인 계정마다 동의한 약관 판과 처리방침 판을 판마다 한 줄 더한다.
export const termsAgreement = pgTable('terms_agreement', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: text('user_id').notNull(),
  termsVersion: text('terms_version').notNull(),
  privacyVersion: text('privacy_version').notNull(),
  agreedAt: at('agreed_at').notNull().defaultNow(),
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
