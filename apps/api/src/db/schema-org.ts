import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'

import { at, day, tstzrange } from './schema-columns.js'

// 공통(vada-docs logical-model.md 공통)
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
  // 그만둔다고 알린 시각(0019, DEC-55). 있으면 학생회는 읽기만 되고, 30일 뒤 privacy council-destroy로 파기한다.
  closingRequestedAt: at('closing_requested_at'),
})

// 탈퇴하면 이름과 이메일을 비우고 탈퇴한 시각을 넣는다(RULE-16). 이름은 표시 이름 도우미(team/display-name.ts)로만 읽는다.
export const member = pgTable('member', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('member'),
  name: text('name'),
  email: text('email'),
  leftAt: at('left_at'),
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
