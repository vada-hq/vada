import { boolean, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

// Better Auth의 사용자 필드. 옛 기능 표는 지웠다. 새 표는 첫 마이그레이션(0000_baseline)과 함께 다시 쓴다.
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
