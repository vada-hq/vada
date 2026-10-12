import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { accounts, chatRooms, departments, eventRetrospectives, events, memberships, messages, organizations, purchaseSubmissions, sessions, users,
  verifications } from './schema.js'

test('all entities have primary keys and creation timestamps', () => {
  for (const table of [users, organizations, departments, memberships, accounts, sessions, verifications, events, chatRooms, messages]) {
    assert.equal(table.id.primary, true)
    assert.equal(table.createdAt.notNull, true)
    assert.equal(table.createdAt.hasDefault, true)
  }
  assert.equal(users.email.isUnique, true)
  assert.equal(users.emailVerified.default, false)
  assert.equal(departments.handlesFinance.default, false)
  assert.equal(departments.isLeadership.default, false)
  assert.equal(departments.isLeadership.notNull, true)
  assert.equal(memberships.title.notNull, false)
})

test('events belong to an organization and retain a user as creator independently of membership', () => {
  const config = getTableConfig(events)
  assert.deepEqual(config.columns.map(column => column.name), ['id', 'organization_id', 'name', 'created_by', 'created_at', 'starts_at', 'ends_at', 'place',
    'version', 'completed_at', 'completed_by', 'owner_department_id', 'owner_id'])
  // 일시·장소(M3a), 완료(M5a), 담당(M5b)만 비울 수 있다.
  assert.deepEqual(config.columns.filter(column => !column.notNull).map(column => column.name), ['starts_at', 'ends_at', 'place', 'completed_at',
    'completed_by', 'owner_department_id', 'owner_id'])
  assert.equal(config.foreignKeys.length, 5)
  // 담당 FK 둘은 복합 키라 첫 칸이 organization_id다. 한 칸짜리 FK만 본다.
  for (const [columnName, parent] of [['organization_id', organizations], ['created_by', users], ['completed_by', users]] as const) {
    const fk = config.foreignKeys.find(key => key.reference().columns.length === 1 && key.reference().columns[0]?.name === columnName)
    assert.ok(fk)
    assert.equal(fk.reference().foreignTable, parent)
    assert.equal(fk.onDelete, 'restrict')
  }
  assert.equal(events.name.isUnique, false)
  assert.deepEqual(config.uniqueConstraints.map(key => key.columns.map(column => column.name)), [['organization_id', 'id']])
  const check = config.checks.find(item => item.name === 'events_name_not_blank')
  assert.ok(check)
  assert.match(new PgDialect().sqlToQuery(check.value).sql, /\[\^\[:space:\]\]/)
})

test('rooms optionally reference one event in the same council; messages reference rooms', () => {
  assert.equal(chatRooms.eventId.notNull, false)
  assert.equal(chatRooms.eventId.isUnique, true)
  const fk = getTableConfig(chatRooms).foreignKeys.find(key => key.reference().columns.length === 2)!
  assert.deepEqual(fk.reference().columns.map(column => column.name), ['organization_id', 'event_id'])
  assert.equal(fk.reference().foreignTable, events)
  assert.deepEqual(getTableConfig(messages).columns.map(column => column.name), ['id', 'chat_room_id', 'author_id', 'content', 'created_at'])
  assert.equal(getTableConfig(messages).foreignKeys.length, 2)
})

test('provider identities are unique and authentication records belong to users', () => {
  assert.equal(accounts.accountId.notNull, true)
  assert.equal(accounts.providerId.notNull, true)
  assert.ok(getTableConfig(accounts).uniqueConstraints.some(({ columns }) =>
    columns.map(column => column.name).join(',') === 'provider_id,account_id',
  ))
  for (const table of [accounts, sessions]) {
    assert.equal(table.userId.notNull, true)
    const fk = getTableConfig(table).foreignKeys[0]
    assert.ok(fk)
    assert.equal(fk.reference().foreignTable, users)
    assert.deepEqual(fk.reference().columns.map(column => column.name), ['user_id'])
    assert.equal(fk.onDelete, 'cascade')
    const indexedColumn = getTableConfig(table).indexes[0]?.config.columns[0]
    assert.ok(indexedColumn && 'name' in indexedColumn)
    assert.equal(indexedColumn.name, 'user_id')
  }
  assert.equal(accounts.password.notNull, false)
  assert.equal(accounts.accessToken.notNull, false)
})

test('sessions require unique tokens and expiry; verification identifiers are not unique', () => {
  assert.equal(sessions.token.notNull, true)
  assert.equal(sessions.token.isUnique, true)
  assert.equal(sessions.expiresAt.notNull, true)
  assert.equal(sessions.ipAddress.notNull, false)
  assert.equal(sessions.userAgent.notNull, false)
  assert.equal(verifications.identifier.notNull, true)
  assert.equal(verifications.identifier.isUnique, false)
  assert.equal(verifications.value.notNull, true)
  assert.equal(verifications.expiresAt.notNull, true)
  const indexedColumn = getTableConfig(verifications).indexes[0]?.config.columns[0]
  assert.ok(indexedColumn && 'name' in indexedColumn)
  assert.equal(indexedColumn.name, 'identifier')
  for (const table of [accounts, sessions, verifications]) {
    assert.equal(table.updatedAt.notNull, true)
    assert.equal(table.updatedAt.hasDefault, true)
    assert.ok(table.updatedAt.onUpdateFn)
  }
})

test('a user has at most one membership in each organization', () => {
  const constraints = getTableConfig(memberships).uniqueConstraints
  assert.ok(constraints.some(({ columns }) =>
    columns.length === 2 && columns[0]?.name === 'organization_id' && columns[1]?.name === 'user_id',
  ))
  assert.equal(memberships.userId.notNull, true)
  assert.equal(memberships.organizationId.notNull, true)
  // 초대로 들어온 구성원은 부서 없이 소속만 생긴다(미배정).
  assert.equal(memberships.departmentId.notNull, false)
})

test('membership department must belong to the same organization', () => {
  const fk = getTableConfig(memberships).foreignKeys.find(key => key.reference().columns.length === 2)
  assert.ok(fk)
  const reference = fk.reference()
  assert.deepEqual(reference.columns.map(column => column.name), ['organization_id', 'department_id'])
  assert.equal(reference.foreignTable, departments)
  assert.deepEqual(reference.foreignColumns.map(column => column.name), ['organization_id', 'id'])
  assert.equal(fk.onDelete, 'restrict')
  assert.ok(getTableConfig(departments).uniqueConstraints.some(({ columns }) =>
    columns.length === 2 && columns[0]?.name === 'organization_id' && columns[1]?.name === 'id',
  ))
})

test('councils keep one invite code each; departments may be unassigned', () => {
  assert.equal(organizations.inviteCode.notNull, true)
  assert.equal(organizations.inviteCode.hasDefault, true)
  const config = getTableConfig(organizations)
  assert.deepEqual(config.uniqueConstraints.map(key => key.name), ['organizations_invite_code_unique'])
  assert.ok(config.checks.some(item => item.name === 'organizations_invite_code_format'))
  assert.equal(purchaseSubmissions.departmentId.notNull, false)
})

test('행사 담당은 같은 학생회의 부서와 소속을 가리킨다', () => {
  const config = getTableConfig(events)
  const department = config.foreignKeys.find(key => key.getName() === 'events_owner_department_same_organization')
  const owner = config.foreignKeys.find(key => key.getName() === 'events_owner_same_organization')
  assert.deepEqual(department?.reference().foreignColumns.map(column => column.name), ['organization_id', 'id'])
  assert.equal(department?.reference().foreignTable, departments)
  assert.equal(department?.onDelete, 'restrict')
  assert.deepEqual(owner?.reference().foreignColumns.map(column => column.name), ['organization_id', 'user_id'])
  assert.equal(owner?.reference().foreignTable, memberships)
  assert.equal(owner?.onDelete, 'restrict')
})

test('회고는 행사마다 하나이고, 같은 학생회 행사와 사용자를 가리킨다', () => {
  const config = getTableConfig(eventRetrospectives)
  assert.deepEqual(config.columns.map(column => column.name), ['event_id', 'organization_id', 'content', 'based_on_completed_at', 'generated_by',
    'generated_at', 'confirmed_by', 'confirmed_at', 'version'])
  assert.equal(eventRetrospectives.eventId.primary, true)
  // 확인 전에는 확인한 사람·때가 없다.
  assert.deepEqual(config.columns.filter(column => !column.notNull).map(column => column.name), ['confirmed_by', 'confirmed_at'])
  const event = config.foreignKeys.find(key => key.getName() === 'event_retrospectives_event_same_organization')
  assert.deepEqual(event?.reference().columns.map(column => column.name), ['organization_id', 'event_id'])
  assert.deepEqual(event?.reference().foreignColumns.map(column => column.name), ['organization_id', 'id'])
  assert.equal(event?.onDelete, 'restrict')
  for (const name of ['event_retrospectives_content_object', 'event_retrospectives_content_size', 'event_retrospectives_confirmed_pair',
    'event_retrospectives_version_positive']) assert.ok(config.checks.some(check => check.name === name), name)
})
