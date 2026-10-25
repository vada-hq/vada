import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { at } from './schema-columns.js'

// 로그인 표 4개(better-auth). 지금 정의 그대로다.
// Google 사진(image)과 토큰 셋은 저장하지 않는다(DEC-53). 칸은 better-auth가 쓰므로 두고, 0017의 CHECK가 늘 NULL로 막는다.
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
// 계정을 지워도 탈퇴하고 1년 남기므로(DEC-55) users를 가리키는 외래 키가 없다.
export const termsAgreement = pgTable('terms_agreement', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: text('user_id').notNull(),
  termsVersion: text('terms_version').notNull(),
  privacyVersion: text('privacy_version').notNull(),
  agreedAt: at('agreed_at').notNull().defaultNow(),
  withdrawnAt: at('withdrawn_at'),
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

// 신청 개인 링크(기능 007, DEC-44). 신청마다 한 줄이고 토큰은 SHA-256 소문자 16진만 둔다. 취소하거나 비우면 지운다.
export const registrationLink = pgTable('registration_link', {
  registrationId: uuid('registration_id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
})

// 신청자 정보 열람 기록(DEC-56). 같은 거래에서 남기고 1년 뒤 지운다. 신청은 한 건일 때만 있다.
export const applicantAccessLog = pgTable('applicant_access_log', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  memberId: uuid('member_id').notNull(),
  councilId: uuid('council_id').notNull(),
  formId: uuid('form_id').notNull(),
  registrationId: uuid('registration_id'),
  action: text('action').notNull(),
  accessedAt: at('accessed_at').notNull().defaultNow(),
  ip: text('ip').notNull(),
})

// 명령 영수증(기능 017, DEC-84). 같은 명령 번호의 재전송에 처음 결과를 돌려주려는 기록이다. 본문 해시는 가명 정보라 24시간 뒤 지운다.
export const commandReceipt = pgTable('command_receipt', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  kind: text('kind').notNull(),
  scopeKey: text('scope_key').notNull(),
  commandId: uuid('command_id').notNull(),
  bodyHash: text('body_hash').notNull(),
  resultId: uuid('result_id').notNull(),
  resultKind: text('result_kind').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
})
