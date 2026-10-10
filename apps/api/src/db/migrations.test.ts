import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsBefore, migrationsFolder } from './test-migrations.js'

// 나중 마이그레이션이 더한 칸(예: organizations.invite_code)은 빼고, 원래 있던 칸의 값만 비교한다.
const sameColumns = (rows: Record<string, unknown>[], before: Record<string, unknown>[]) =>
  rows.map((row, index) => Object.fromEntries(Object.keys(before[index] ?? row).map(key => [key, row[key]])))

test('event migration upgrades existing data and enforces event constraints', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-event-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    journal.entries = journal.entries.slice(0, 2)
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u1','Planner','planner@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council');
      INSERT INTO departments (id,organization_id,name) VALUES ('d1','org1','Planning'),('d2','org1','Finance');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','u1','org1','d1');
      INSERT INTO accounts (id,user_id,provider_id,account_id) VALUES ('a1','u1','google','test-subject');
      INSERT INTO sessions (id,user_id,token,expires_at) VALUES ('s1','u1','test-token',now()+interval '1 day');
      INSERT INTO verifications (id,identifier,value,expires_at) VALUES ('v1','test','test-value',now()+interval '1 day');
    `)
    const oldTables = ['users', 'organizations', 'departments', 'memberships', 'accounts', 'sessions', 'verifications']
    const before = await Promise.all(oldTables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
    await migrate(db, { migrationsFolder: folder })
    await t.test('all existing rows survive the upgrade', async () => {
      const after = await Promise.all(oldTables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
      // 0010은 학생회마다 회장단 행을 새로 만든다. 원래 있던 행만 비교한다.
      const kept = after.map((result, index) => result.rows.filter(row => before[index]!.rows.some(old => old.id === row.id)))
      assert.deepEqual(kept.map((rows, index) => sameColumns(rows, before[index]!.rows)), before.map(result => result.rows))
    })
    const insert = (id: string, name: string | null, org = 'org1', creator = 'u1') => pg.query(
      'INSERT INTO events (id,organization_id,name,created_by) VALUES ($1,$2,$3,$4)', [id, org, name, creator],
    )
    await t.test('valid names including duplicates are accepted', async () => {
      await insert('e1', '가을 행사')
      await insert('e2', '가을 행사')
      const result = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM events WHERE created_at IS NOT NULL')
      assert.equal(result.rows[0]?.count, 2)
    })
    await t.test('empty and whitespace-only names and null names are rejected', async () => {
      for (const name of ['', '   ', '\t\r\n']) {
        await assert.rejects(insert('invalid', name), { code: '23514', constraint: 'events_name_not_blank' })
      }
      await assert.rejects(insert('invalid', null), { code: '23502' })
    })
    await t.test('missing organization and creator are rejected', async () => {
      await assert.rejects(insert('invalid', '행사', 'missing'), { code: '23503', constraint: 'events_organization_id_organizations_id_fk' })
      await assert.rejects(insert('invalid', '행사', 'org1', 'missing'), { code: '23503', constraint: 'events_created_by_users_id_fk' })
    })
    await t.test('department change and leaving membership preserve events', async () => {
      await pg.query("UPDATE memberships SET department_id='d2' WHERE id='m1'")
      await pg.query("DELETE FROM memberships WHERE id='m1'")
      const result = await pg.query<{ created_by: string }>('SELECT created_by FROM events ORDER BY id')
      assert.deepEqual(result.rows, [{ created_by: 'u1' }, { created_by: 'u1' }])
      await assert.rejects(pg.query("DELETE FROM users WHERE id='u1'"), { code: '23001', constraint: 'events_created_by_users_id_fk' })
      await pg.query("INSERT INTO organizations (id,name) VALUES ('org2','Second council')")
      await insert('e3', '별도 행사', 'org2')
      await assert.rejects(pg.query("DELETE FROM organizations WHERE id='org2'"), { code: '23001', constraint: 'events_organization_id_organizations_id_fk' })
    })
    await t.test('reapplying migrations preserves events and does not duplicate history', async () => {
      await migrate(db, { migrationsFolder: folder })
      assert.equal((await pg.query('SELECT id FROM events')).rows.length, 3)
      const currentJournal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
      assert.equal((await pg.query('SELECT id FROM drizzle.__drizzle_migrations')).rows.length, currentJournal.entries.length)
    })
  } finally {
    await pg.close()
    // 이 테스트가 mkdtempSync로 만든 전용 임시 폴더만 정리한다.
    rmSync(previous, { recursive: true, force: true })
  }
})

test('chat migration backfills event rooms and enforces room/message boundaries', async () => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-chat-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    journal.entries = journal.entries.slice(0, 3)
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('u','User','u@test.local');
      INSERT INTO organizations(id,name) VALUES ('o','Council'),('other','Other');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','o','Event','u');
    `)
    const before = (await pg.query('SELECT * FROM events')).rows
    await migrate(db, { migrationsFolder: folder })
    assert.deepEqual(sameColumns((await pg.query<Record<string, unknown>>('SELECT * FROM events')).rows, before), before)
    const rooms = await pg.query<{ id: string; organization_id: string; event_id: string }>('SELECT id,organization_id,event_id FROM chat_rooms')
    assert.equal(rooms.rows.length, 1)
    assert.equal(rooms.rows[0]?.event_id, 'e')
    assert.equal(rooms.rows[0]?.organization_id, 'o')
    await assert.rejects(pg.query("INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('dup','o','e')"), { code: '23505' })
    await pg.exec("INSERT INTO events(id,organization_id,name,created_by) VALUES ('other-event','other','Other','u')")
    await assert.rejects(pg.query("INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('cross','o','other-event')"), { code: '23503' })
    await assert.rejects(pg.query("INSERT INTO chat_rooms(id,organization_id) VALUES ('missing','missing')"), { code: '23503' })
    await pg.exec("INSERT INTO chat_rooms(id,organization_id) VALUES ('r1','o'),('r2','o')")
    const insert = (content: string, room = 'r1', author = 'u') => pg.query('INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ($1,$2,$3,$4)', ['m', room, author, content])
    for (const content of ['', ' \t\n', 'a'.repeat(2001)]) await assert.rejects(insert(content), { code: '23514' })
    await assert.rejects(insert('Hi', 'missing'), { code: '23503' })
    await assert.rejects(insert('Hi', 'r1', 'missing'), { code: '23503' })
    await insert('a'.repeat(2000))
    await assert.rejects(pg.query("DELETE FROM chat_rooms WHERE id='r1'"), { code: '23001' })
    await assert.rejects(pg.query("DELETE FROM events WHERE id='e'"), { code: '23001' })
    await migrate(db, { migrationsFolder: folder })
    assert.equal((await pg.query('SELECT id FROM chat_rooms')).rows.length, 3)
    assert.equal((await pg.query('SELECT id FROM messages')).rows.length, 1)
  } finally {
    await pg.close()
    // 이 테스트가 만든 전용 임시 폴더만 정리한다.
    rmSync(previous, { recursive: true, force: true })
  }
})

test('generated migrations enforce membership and authentication constraints in PostgreSQL (PGlite)', async (t) => {
  // 경로나 연결 문자열을 전달하지 않고 테스트 전용 메모리 DB만 사용한다.
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    const config = { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) }
    await migrate(db, config)
    await pg.exec(`
      INSERT INTO users (id, name, email) VALUES ('u1', 'Planner', 'planner@example.test');
      INSERT INTO organizations (id, name) VALUES ('org1', 'Council 1'), ('org2', 'Council 2');
      INSERT INTO departments (id, organization_id, name) VALUES
        ('d1', 'org1', 'Planning'), ('d2', 'org1', 'Finance'), ('d3', 'org2', 'Planning');
    `)

    await t.test('valid membership is saved', async () => {
      await pg.query('INSERT INTO memberships (id, user_id, organization_id, department_id) VALUES ($1, $2, $3, $4)', ['m1', 'u1', 'org1', 'd1'])
      const result = await pg.query<{ department_id: string }>('SELECT department_id FROM memberships WHERE id = $1', ['m1'])
      assert.equal(result.rows[0]?.department_id, 'd1')
    })

    await t.test('duplicate membership is rejected even for a different department', async () => {
      await assert.rejects(
        pg.query('INSERT INTO memberships (id, user_id, organization_id, department_id) VALUES ($1, $2, $3, $4)', ['m2', 'u1', 'org1', 'd2']),
        { code: '23505', constraint: 'memberships_organization_user_unique' },
      )
    })

    await t.test('department from another organization is rejected', async () => {
      await assert.rejects(
        pg.query('INSERT INTO memberships (id, user_id, organization_id, department_id) VALUES ($1, $2, $3, $4)', ['m3', 'u1', 'org2', 'd1']),
        { code: '23503', constraint: 'memberships_department_same_organization' },
      )
    })

    await t.test('the same user can belong to a different organization', async () => {
      await pg.query('INSERT INTO memberships (id, user_id, organization_id, department_id) VALUES ($1, $2, $3, $4)', ['m4', 'u1', 'org2', 'd3'])
      const result = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM memberships')
      assert.equal(result.rows[0]?.count, 2)
    })

    await t.test('running migrations again preserves existing data', async () => {
      await migrate(db, config)
      const result = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM memberships')
      assert.equal(result.rows[0]?.count, 2)
    })

    await t.test('authentication migrations enforce identity, session and deletion constraints', async () => {
      await pg.exec(`
        INSERT INTO users (id, name, email) VALUES ('u2', 'Tester', 'tester@example.test');
        INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES
          ('a1', 'u1', 'google', 'google-1'), ('a2', 'u2', 'google', 'google-2');
        INSERT INTO sessions (id, user_id, token, expires_at) VALUES
          ('s1', 'u1', 'test-token-1', now() + interval '1 day'),
          ('s2', 'u2', 'test-token-2', now() + interval '1 day');
        INSERT INTO verifications (id, identifier, value, expires_at) VALUES
          ('v1', 'test-identifier', 'value-1', now() + interval '1 day'),
          ('v2', 'test-identifier', 'value-2', now() + interval '1 day');
      `)
      await assert.rejects(
        pg.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ('a3', 'u2', 'google', 'google-1')"),
        { code: '23505', constraint: 'accounts_provider_account_unique' },
      )
      await assert.rejects(
        pg.query("INSERT INTO sessions (id, user_id, token, expires_at) VALUES ('s3', 'u2', 'test-token-1', now())"),
        { code: '23505', constraint: 'sessions_token_unique' },
      )
      await assert.rejects(
        pg.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ('a4', 'missing', 'google', 'google-4')"),
        { code: '23503' },
      )
      await assert.rejects(
        pg.query("INSERT INTO sessions (id, user_id, token, expires_at) VALUES ('s4', 'missing', 'test-token-4', now())"),
        { code: '23503' },
      )
      await assert.rejects(pg.query("DELETE FROM users WHERE id = 'u1'"), {
        code: '23001', constraint: 'memberships_user_id_users_id_fk',
      })
      await pg.query("DELETE FROM users WHERE id = 'u2'")
      await migrate(db, config)
      const accounts = await pg.query<{ id: string }>('SELECT id FROM accounts ORDER BY id')
      const sessions = await pg.query<{ id: string }>('SELECT id FROM sessions ORDER BY id')
      const verifications = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM verifications')
      assert.deepEqual(accounts.rows, [{ id: 'a1' }])
      assert.deepEqual(sessions.rows, [{ id: 's1' }])
      assert.equal(verifications.rows[0]?.count, 2)
    })
  } finally {
    await pg.close()
  }
})

test('0009 gives every council an invite code and lets departments be empty', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-invite-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0009_organization_invite_code')
    assert.ok(index > 0, '0009 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u1','Planner','p@example.test'),('u2','New','n@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name) VALUES ('d1','org1','Planning'),('d2','org2','Planning');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','u1','org1','d1');
    `)
    await migrate(db, { migrationsFolder: folder })
    const codes = (await pg.query<{ invite_code: string }>('SELECT invite_code FROM organizations ORDER BY id')).rows.map(row => row.invite_code)

    await t.test('existing councils get distinct codes in the agreed format', () => {
      assert.equal(codes.length, 2)
      for (const code of codes) assert.match(code, /^[2-9A-HJ-NP-Z]{8}$/)
      assert.notEqual(codes[0], codes[1])
    })
    await t.test('existing membership keeps its department', async () => {
      const result = await pg.query<{ department_id: string }>("SELECT department_id FROM memberships WHERE id = 'm1'")
      assert.equal(result.rows[0]?.department_id, 'd1')
    })
    await t.test('new councils get a code; duplicate and malformed codes are rejected', async () => {
      await pg.query("INSERT INTO organizations (id,name) VALUES ('org3','Council 3')")
      const created = await pg.query<{ invite_code: string }>("SELECT invite_code FROM organizations WHERE id = 'org3'")
      assert.match(created.rows[0]!.invite_code, /^[2-9A-HJ-NP-Z]{8}$/)
      await assert.rejects(pg.query("INSERT INTO organizations (id,name,invite_code) VALUES ('org4','Council 4',$1)", [codes[0]]),
        { code: '23505', constraint: 'organizations_invite_code_unique' })
      for (const bad of ['abcd2345', 'ABCD0123', 'ABCD234', 'ABCD23456']) {
        await assert.rejects(pg.query("INSERT INTO organizations (id,name,invite_code) VALUES ('org5','Council 5',$1)", [bad]),
          { code: '23514', constraint: 'organizations_invite_code_format' })
      }
    })
    // 0009가 함께 바꾼 옛 요청서 표는 0013에서 지웠다. 제출 기록의 부서 규칙은 db/purchases.test.ts가 확인한다.
    await t.test('membership may have no department, but a set one must match the council', async () => {
      await pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m2','u2','org1',NULL)")
      await assert.rejects(pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m3','u2','org2','d1')"),
        { code: '23503', constraint: 'memberships_department_same_organization' })
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})

test('0010 gives every council one empty leadership and keeps existing members', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-organization-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0010_organization_structure')
    assert.ok(index > 0, '0010 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u1','Planner','p@example.test'),('u2','Treasurer','t@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Planning',false),('d2','org1','Finance',true),('d3','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','u1','org1','d1'),('m2','u2','org1','d2');
    `)
    await migrate(db, { migrationsFolder: folder })

    await t.test('each council gets exactly one empty leadership named 회장단', async () => {
      const rows = await pg.query(`
        SELECT d.organization_id, d.name, d.handles_finance, (SELECT count(*)::int FROM memberships m WHERE m.department_id = d.id) AS members
        FROM departments d WHERE d.is_leadership ORDER BY d.organization_id`)
      assert.deepEqual(rows.rows, [
        { organization_id: 'org1', name: '회장단', handles_finance: false, members: 0 },
        { organization_id: 'org2', name: '회장단', handles_finance: false, members: 0 },
      ])
    })
    await t.test('existing departments and memberships are unchanged', async () => {
      const departments = await pg.query('SELECT id, is_leadership, handles_finance FROM departments WHERE NOT is_leadership ORDER BY id')
      assert.deepEqual(departments.rows, [
        { id: 'd1', is_leadership: false, handles_finance: false },
        { id: 'd2', is_leadership: false, handles_finance: true },
        { id: 'd3', is_leadership: false, handles_finance: false },
      ])
      const members = await pg.query('SELECT id, department_id, title FROM memberships ORDER BY id')
      assert.deepEqual(members.rows, [{ id: 'm1', department_id: 'd1', title: null }, { id: 'm2', department_id: 'd2', title: null }])
    })
    await t.test('a second leadership and a leadership with the finance flag are rejected', async () => {
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name,is_leadership) VALUES ('l2','org1','Leaders 2',true)"),
        { code: '23505', constraint: 'departments_one_leadership' })
      await assert.rejects(pg.query("UPDATE departments SET handles_finance = true WHERE organization_id = 'org1' AND is_leadership"),
        { code: '23514', constraint: 'departments_leadership_not_finance' })
    })
    await t.test('titles are optional, not blank and at most 20 characters', async () => {
      await pg.query("UPDATE memberships SET title = '회장' WHERE id = 'm1'")
      await pg.query("UPDATE memberships SET title = $1 WHERE id = 'm1'", ['😀'.repeat(20)])
      await pg.query("UPDATE memberships SET title = NULL WHERE id = 'm1'")
      await assert.rejects(pg.query("UPDATE memberships SET title = '  ' WHERE id = 'm1'"), { code: '23514', constraint: 'memberships_title_not_blank' })
      await assert.rejects(pg.query("UPDATE memberships SET title = $1 WHERE id = 'm1'", ['가'.repeat(21)]), { code: '23514', constraint: 'memberships_title_length' })
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})

test('0011 enforces council and department name rules', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-names-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0011_organization_names')
    assert.ok(index > 0, '0011 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name) VALUES ('d1','org1','기획부'),('d2','org2','기획부');
    `)
    await migrate(db, { migrationsFolder: folder })

    await t.test('the same department name is allowed only across councils', async () => {
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d3','org1','기획부')"),
        { code: '23505', constraint: 'departments_organization_name_unique' })
    })
    await t.test('blank and too long names are rejected', async () => {
      await assert.rejects(pg.query("INSERT INTO organizations (id,name) VALUES ('org3','  ')"), { code: '23514', constraint: 'organizations_name_not_blank' })
      await assert.rejects(pg.query("INSERT INTO organizations (id,name) VALUES ('org3',$1)", ['가'.repeat(51)]), { code: '23514', constraint: 'organizations_name_length' })
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',' ')"), { code: '23514', constraint: 'departments_name_not_blank' })
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',$1)", ['가'.repeat(21)]), { code: '23514', constraint: 'departments_name_length' })
      await pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',$1)", ['😀'.repeat(20)])
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})

test('0012 moves purchase requests to purchase items with their decisions, sources and history', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-purchase-items-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0012_purchase_items')
    assert.ok(index > 0, '0012 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    const url = (n: number) => `https://www.coupang.com/vp/products/${n}`
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test'),('f','재정','f@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council');
      INSERT INTO departments (id,organization_id,name) VALUES ('d','o','기획부');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('mu','u','o','d');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u');
      INSERT INTO chat_rooms (id,organization_id,event_id) VALUES ('room','o','e');
      INSERT INTO messages (id,chat_room_id,author_id,content) VALUES ('m1','room','u','테이블 2개');
      INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,department_id,purpose,needed_by,status,idempotency_key,version) VALUES
        ('r-draft','o','e','u','d','부스','2026-10-20','draft','k1',1),
        ('r-sub','o','e','u','d',NULL,NULL,'submitted','k2',2),
        ('r-ok','o','e','u','d','계주','2026-10-21','approved','k3',3),
        ('r-no','o','e','u',NULL,NULL,NULL,'rejected','k4',3),
        ('r-gone','o','e','u','d',NULL,NULL,'discarded','k5',2);
      INSERT INTO purchase_items (id,request_id,position,product_url,product_name,quantity) VALUES
        ('i1','r-draft',0,'${url(1)}','테이블',2),('i2','r-draft',1,'${url(2)}',NULL,NULL),('i3','r-sub',0,'${url(3)}','의자',1),
        ('i4','r-ok',0,'${url(4)}','생수',10),('i5','r-no',0,'${url(5)}','이름표',200),('i6','r-gone',0,'${url(6)}','버린 것',1);
      INSERT INTO purchase_request_history (id,request_id,actor_id,action,version,changes,reason,created_at) VALUES
        ('h1','r-draft','u','created',1,'{"inputLinks":["${url(1)}","${url(2)}"],"warnings":["품목 1: 옵션 확인"]}',NULL,'2026-10-01T00:00:00Z'),
        ('h2','r-sub','u','created',1,'{}',NULL,'2026-10-01T00:00:00Z'),
        ('h3','r-sub','u','submitted',2,'{}',NULL,'2026-10-02T00:00:00Z'),
        ('h4','r-ok','u','created',1,'{}',NULL,'2026-10-01T00:00:00Z'),
        ('h5','r-ok','u','submitted',2,'{}',NULL,'2026-10-02T00:00:00Z'),
        ('h6','r-ok','f','approved',3,'{}',NULL,'2026-10-03T00:00:00Z'),
        ('h7','r-no','u','created',1,'{}',NULL,'2026-10-01T00:00:00Z'),
        ('h8','r-no','u','submitted',2,'{}',NULL,'2026-10-02T00:00:00Z'),
        ('h9','r-no','f','rejected',3,'{}','수량 확인','2026-10-03T00:00:00Z'),
        ('h10','r-gone','u','created',1,'{}',NULL,'2026-10-01T00:00:00Z'),
        ('h11','r-gone','u','discarded',2,'{}',NULL,'2026-10-02T00:00:00Z');
      INSERT INTO purchase_request_sources (request_id,message_id) VALUES ('r-ok','m1');
    `)
    await migrate(db, { migrationsFolder: folder })
    const rows = async (query: string) => (await pg.query<Record<string, unknown>>(query)).rows

    await t.test('requests become generations and submitted ones become submissions', async () => {
      assert.deepEqual(await rows('SELECT id, links FROM purchase_generations ORDER BY id'), [
        { id: 'r-draft', links: [url(1), url(2)] }, { id: 'r-no', links: [url(5)] }, { id: 'r-ok', links: [url(4)] }, { id: 'r-sub', links: [url(3)] }])
      assert.deepEqual(await rows("SELECT id, department_id, to_char(submitted_at AT TIME ZONE 'UTC', 'MM-DD') AS day FROM purchase_submissions ORDER BY id"), [
        { id: 'r-no', department_id: null, day: '10-02' }, { id: 'r-ok', department_id: 'd', day: '10-02' }, { id: 'r-sub', department_id: 'd', day: '10-02' }])
    })
    await t.test('items keep their content and take the request status, decision, note and date', async () => {
      const common = { organization_id: 'o', event_id: 'e', requester_id: 'u', version: 1 }
      assert.deepEqual(await rows(`SELECT id, organization_id, event_id, requester_id, generation_id, submission_id, status, note,
        to_char(needed_by, 'YYYY-MM-DD') AS needed_by, warnings, decided_by, decision_reason, version FROM purchase_items ORDER BY id`), [
        { id: 'i1', ...common, generation_id: 'r-draft', submission_id: null, status: 'draft', note: '부스', needed_by: '2026-10-20', warnings: ['품목 1: 옵션 확인'], decided_by: null, decision_reason: null },
        { id: 'i2', ...common, generation_id: 'r-draft', submission_id: null, status: 'draft', note: '부스', needed_by: '2026-10-20', warnings: ['품목 1: 옵션 확인'], decided_by: null, decision_reason: null },
        { id: 'i3', ...common, generation_id: 'r-sub', submission_id: 'r-sub', status: 'pending', note: null, needed_by: null, warnings: [], decided_by: null, decision_reason: null },
        { id: 'i4', ...common, generation_id: 'r-ok', submission_id: 'r-ok', status: 'approved', note: '계주', needed_by: '2026-10-21', warnings: [], decided_by: 'f', decision_reason: null },
        { id: 'i5', ...common, generation_id: 'r-no', submission_id: 'r-no', status: 'rejected', note: null, needed_by: null, warnings: [], decided_by: 'f', decision_reason: '수량 확인' },
      ])
    })
    await t.test('decisions and submissions become item history; sources follow the items; discarded drafts are gone', async () => {
      assert.deepEqual(await rows('SELECT item_id, actor_id, action, reason, batch_id FROM purchase_item_events ORDER BY item_id, created_at'), [
        { item_id: 'i3', actor_id: 'u', action: 'submitted', reason: null, batch_id: 'r-sub' },
        { item_id: 'i4', actor_id: 'u', action: 'submitted', reason: null, batch_id: 'r-ok' },
        { item_id: 'i4', actor_id: 'f', action: 'approved', reason: null, batch_id: 'r-ok' },
        { item_id: 'i5', actor_id: 'u', action: 'submitted', reason: null, batch_id: 'r-no' },
        { item_id: 'i5', actor_id: 'f', action: 'rejected', reason: '수량 확인', batch_id: 'r-no' },
      ])
      assert.deepEqual(await rows('SELECT item_id, message_id FROM purchase_item_sources'), [{ item_id: 'i4', message_id: 'm1' }])
      assert.deepEqual(await rows("SELECT id FROM purchase_items WHERE id = 'i6'"), [])
    })
    await t.test('new rules reject inconsistent items and events', async () => {
      const insert = (values: string) => pg.query(`INSERT INTO purchase_items (id, organization_id, event_id, requester_id, product_url, status,
        submission_id, decided_by, decided_at, decision_reason, purchased_by, purchased_at, received_by, received_at, note) VALUES ${values}`)
      await assert.rejects(pg.query("INSERT INTO purchase_items (id, event_id, requester_id, product_url) VALUES ('n1','e','u','x')"), { code: '23502' })
      const cases: [string, string][] = [
        [`('n2','o','e','u','x','draft','r-sub',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)`, 'purchase_items_draft_unsubmitted'],
        [`('n3','o','e','u','x','approved','r-sub',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)`, 'purchase_items_decided_status'],
        [`('n4','o','e','u','x','rejected','r-sub','f',now(),NULL,NULL,NULL,NULL,NULL,NULL)`, 'purchase_items_rejection_reason'],
        [`('n5','o','e','u','x','pending','r-sub',NULL,NULL,NULL,'f',now(),NULL,NULL,NULL)`, 'purchase_items_purchase_approved'],
        [`('n6','o','e','u','x','approved','r-sub','f',now(),NULL,NULL,NULL,'u',now(),NULL)`, 'purchase_items_receipt_purchased'],
        [`('n7','o','e','u','x','draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'${'가'.repeat(201)}')`, 'purchase_items_note_length'],
        [`('n8','o','e','u','x','cancelled','missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)`, 'purchase_items_submission_same_organization'],
      ]
      for (const [values, constraint] of cases) await assert.rejects(insert(values), { constraint }, constraint)
      await assert.rejects(pg.query("INSERT INTO purchase_item_events (id, organization_id, item_id, actor_id, action) VALUES ('v1','o','i5','f','rejected')"),
        { constraint: 'purchase_item_events_reason' })
      await assert.rejects(pg.query("INSERT INTO purchase_item_events (id, organization_id, item_id, actor_id, action) VALUES ('v2','other','i5','f','submitted')"),
        { code: '23503' })
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})

test('0013 removes the old request tables and guards item text and shipment links', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0013_purchase_cleanup')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    // 0012까지 적용된 DB: 옛 요청서에서 옮긴 품목과 새 코드가 만든 품목, 옛 방식·새 방식 송장 연결이 섞여 있다.
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test'),('f','재정','f@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,status,idempotency_key) VALUES ('r','o','e','u','approved','k');
      INSERT INTO purchase_submissions (id,organization_id,event_id,requester_id) VALUES ('s','o','e','u'),('s2','o2','e2','u');
      INSERT INTO purchase_items (id,request_id,position,organization_id,event_id,requester_id,submission_id,status,decided_by,decided_at,product_url,product_name) VALUES
        ('old','r',0,'o','e','u','s','approved','f',now(),'https://www.coupang.com/vp/products/1','옛 품목');
      INSERT INTO purchase_items (id,organization_id,event_id,requester_id,submission_id,status,decided_by,decided_at,product_url,product_name,selected_option,packaging_unit) VALUES
        ('new','o','e','u','s','approved','f',now(),'https://www.coupang.com/vp/products/2','새 품목','화이트','50개입'),
        ('other','o2','e2','u','s2','approved','f',now(),'https://www.coupang.com/vp/products/3','남의 품목',NULL,NULL);
      INSERT INTO shipments (id,organization_id,carrier_id,tracking_number,created_by) VALUES ('ship','o','kr.coupangls','000123','f');
      INSERT INTO shipment_items (id,shipment_id,purchase_item_id,request_id,organization_id,linked_by) VALUES
        ('l-old','ship','old','r','o','f'),('l-new','ship','new',NULL,'o','f');
    `)
    await migrate(db, { migrationsFolder })
    const rows = async (query: string) => (await pg.query<Record<string, unknown>>(query)).rows

    await t.test('old request tables and columns are gone; items and links stay', async () => {
      assert.deepEqual(await rows(`SELECT to_regclass('public.purchase_requests') AS requests, to_regclass('public.purchase_request_sources') AS sources,
        to_regclass('public.purchase_request_history') AS history`), [{ requests: null, sources: null, history: null }])
      assert.deepEqual(await rows(`SELECT table_name, column_name FROM information_schema.columns
        WHERE table_name IN ('purchase_items','shipment_items') AND column_name IN ('request_id','position')`), [])
      assert.deepEqual(await rows('SELECT id FROM purchase_items ORDER BY id'), [{ id: 'new' }, { id: 'old' }, { id: 'other' }])
      assert.deepEqual(await rows('SELECT id, purchase_item_id FROM shipment_items ORDER BY id'),
        [{ id: 'l-new', purchase_item_id: 'new' }, { id: 'l-old', purchase_item_id: 'old' }])
    })
    await t.test('item text has the contract limits and cannot be blank', async () => {
      const update = (column: string, value: string) => pg.query(`UPDATE purchase_items SET ${column} = $1 WHERE id = 'new'`, [value])
      for (const [column, max] of [['product_name', 500], ['selected_option', 200], ['packaging_unit', 50]] as const) {
        // 계약처럼 코드 포인트로 센다. 이모지도 한 글자다.
        await update(column, '😀'.repeat(max))
        await assert.rejects(update(column, '😀'.repeat(max + 1)), { constraint: `purchase_items_${column}_length` })
        for (const blank of ['', '   ', '\t\n']) await assert.rejects(update(column, blank), { constraint: `purchase_items_${column}_not_blank` })
      }
    })
    await t.test('a shipment link must point to an item of the same council, found by its index', async () => {
      const link = (id: string, item: string) => pg.query(
        "INSERT INTO shipment_items (id,shipment_id,purchase_item_id,organization_id,linked_by) VALUES ($1,'ship',$2,'o','f')", [id, item])
      await assert.rejects(link('cross', 'other'), { code: '23503', constraint: 'shipment_items_item_same_organization' })
      await assert.rejects(link('missing', 'nope'), { code: '23503', constraint: 'shipment_items_item_same_organization' })
      await assert.rejects(pg.exec("DELETE FROM purchase_items WHERE id = 'new'"), { code: '23001' })
      assert.deepEqual(await rows("SELECT indexdef FROM pg_indexes WHERE indexname = 'shipment_items_item_idx'"),
        [{ indexdef: 'CREATE INDEX shipment_items_item_idx ON public.shipment_items USING btree (organization_id, purchase_item_id)' }])
    })
  } finally {
    await pg.close()
    previous.remove()
  }
})

test('0014 adds candidates and product lookups without touching existing items', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0014_purchase_candidates')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO chat_rooms (id,organization_id,event_id) VALUES ('room','o','e');
      INSERT INTO messages (id,chat_room_id,author_id,content) VALUES ('m','room','u','링크');
      INSERT INTO purchase_items (id,organization_id,event_id,requester_id,product_url) VALUES ('i','o','e','u','https://www.coupang.com/vp/products/1');
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows
    await migrate(db, { migrationsFolder })

    await t.test('existing items keep their values and have no candidate', async () => {
      const after = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows
      assert.deepEqual(after.map(row => Object.fromEntries(Object.keys(before[0]!).map(key => [key, row[key]]))), before)
      assert.equal(after[0]!.candidate_id, null)
    })
    await t.test('product rows keep a digit id, a known status and a bounded option list', async () => {
      await pg.exec("INSERT INTO coupang_products (id) VALUES ('1')")
      assert.deepEqual((await pg.query("SELECT status, items, attempts, error_code FROM coupang_products WHERE id = '1'")).rows,
        [{ status: 'pending', items: [], attempts: 0, error_code: null }])
      const cases: [string, string][] = [
        ["INSERT INTO coupang_products (id) VALUES ('12a')", 'coupang_products_id_digits'],
        ["INSERT INTO coupang_products (id, status) VALUES ('2','done')", 'coupang_products_status_valid'],
        ["INSERT INTO coupang_products (id, status) VALUES ('3','ready')", 'coupang_products_ready_fetched'],
        ["INSERT INTO coupang_products (id, items) VALUES ('4','{}')", 'coupang_products_items_array'],
        [`INSERT INTO coupang_products (id, items) VALUES ('5','[${Array(101).fill('{}').join(',')}]')`, 'coupang_products_items_array'],
        ["INSERT INTO coupang_products (id, error_code) VALUES ('6','boom')", 'coupang_products_error_code'],
        ["INSERT INTO coupang_products (id, attempts) VALUES ('7',-1)", 'coupang_products_attempts_nonnegative'],
      ]
      for (const [statement, constraint] of cases) await assert.rejects(pg.exec(statement), { constraint }, constraint)
    })
    await t.test('a product option appears once per event, and an unknown option once per product', async () => {
      const candidate = (id: string, vendor: string | null, event = 'e', org = 'o') => pg.query(
        "INSERT INTO purchase_candidates (id,organization_id,event_id,product_id,vendor_item_id,url) VALUES ($1,$2,$3,'1',$4,'https://www.coupang.com/vp/products/1')",
        [id, org, event, vendor])
      await candidate('c1', '9'); await candidate('c2', null); await candidate('c3', '8')
      await assert.rejects(candidate('dup', '9'), { constraint: 'purchase_candidates_event_product_vendor_unique' })
      await assert.rejects(candidate('dup2', null), { constraint: 'purchase_candidates_event_product_vendor_unique' })
      await candidate('other', null, 'e2', 'o2')
      // 고유 제약에 먼저 걸리지 않도록 다른 옵션으로 학생회 경계만 확인한다.
      await assert.rejects(candidate('cross', '7', 'e2', 'o'), { constraint: 'purchase_candidates_event_same_organization' })
      const cases: [string, string][] = [
        ["UPDATE purchase_candidates SET hidden_at = now() WHERE id = 'c1'", 'purchase_candidates_hidden_pair'],
        ["UPDATE purchase_candidates SET url = 'https://evil.test/x' WHERE id = 'c1'", 'purchase_candidates_url'],
        ["UPDATE purchase_candidates SET vendor_item_id = 'x' WHERE id = 'c1'", 'purchase_candidates_vendor_digits'],
        ["UPDATE purchase_candidates SET item_id = '1a' WHERE id = 'c1'", 'purchase_candidates_item_digits'],
      ]
      for (const [statement, constraint] of cases) await assert.rejects(pg.exec(statement), { constraint }, constraint)
    })
    await t.test('shares keep message order and items point to a candidate of the same council', async () => {
      const share = (position: number, candidate = 'c1', org = 'o') => pg.query(
        'INSERT INTO purchase_candidate_shares (organization_id,candidate_id,message_id,position) VALUES ($1,$2,$3,$4)', [org, candidate, 'm', position])
      await share(0); await share(1, 'c2')
      await assert.rejects(share(0, 'c3'), { code: '23505' })
      await assert.rejects(share(10, 'c3'), { constraint: 'purchase_candidate_shares_position' })
      await assert.rejects(share(2, 'other'), { constraint: 'purchase_candidate_shares_candidate_same_organization' })
      await pg.exec("UPDATE purchase_items SET candidate_id = 'c1' WHERE id = 'i'")
      await assert.rejects(pg.exec("UPDATE purchase_items SET candidate_id = 'other' WHERE id = 'i'"), { constraint: 'purchase_items_candidate_same_organization' })
      await assert.rejects(pg.exec("DELETE FROM purchase_candidates WHERE id = 'c1'"), { code: '23001' })
    })
  } finally {
    await pg.close()
    previous.remove()
  }
})
test('0015 adds expenses without touching purchase items', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0015_expenses')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO purchase_items (id,organization_id,event_id,requester_id,product_url) VALUES ('i','o','e','u','https://www.coupang.com/vp/products/1');
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows
    await migrate(db, { migrationsFolder })
    const insert = (table: string, id: string, values: Record<string, string>) =>
      pg.exec(`INSERT INTO ${table} (id,${Object.keys(values).join(',')}) VALUES ('${id}',${Object.values(values).join(',')})`)
    const expense = (id: string, change: Record<string, string> = {}) => insert('expenses', id, { organization_id: "'o'", event_id: "'e'",
      vendor: "'쿠팡'", description: "'물품'", amount: '1000', paid_on: "'2026-10-09'", method: "'council_card'", payer_id: "'u'",
      recorded_by: "'u'", note: 'NULL', voided_at: 'NULL', voided_by: 'NULL', void_reason: 'NULL', ...change })

    await t.test('existing items keep their values', async () => {
      assert.deepEqual((await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows, before)
    })
    await t.test('expense text, amount, date, method and cancellation fields are checked', async () => {
      await expense('x1')
      await expense('x2', { event_id: 'NULL' })
      const cases: [Record<string, string>, string][] = [
        [{ vendor: "'  '" }, 'expenses_vendor_not_blank'],
        [{ vendor: `'${'가'.repeat(101)}'` }, 'expenses_vendor_length'],
        [{ description: "''" }, 'expenses_description_not_blank'],
        [{ description: `'${'가'.repeat(201)}'` }, 'expenses_description_length'],
        [{ amount: '-1' }, 'expenses_amount_nonnegative'],
        [{ paid_on: "'1999-12-31'" }, 'expenses_paid_on_range'],
        [{ method: "'card'" }, 'expenses_method_valid'],
        [{ note: "' '" }, 'expenses_note_not_blank'],
        [{ note: `'${'가'.repeat(201)}'` }, 'expenses_note_length'],
        [{ voided_at: 'now()' }, 'expenses_void_triple'],
        [{ voided_at: 'now()', voided_by: "'u'", void_reason: "' '" }, 'expenses_void_reason_not_blank'],
        [{ event_id: "'e2'" }, 'expenses_event_same_organization'],
      ]
      for (const [change, constraint] of cases) await assert.rejects(expense(`bad-${constraint}`, change), { constraint }, constraint)
    })
    await t.test('an item links to one expense of the same council', async () => {
      const link = (expenseId: string, organizationId = 'o') =>
        pg.exec(`INSERT INTO expense_items (purchase_item_id,organization_id,expense_id) VALUES ('i','${organizationId}','${expenseId}')`)
      await link('x1')
      await assert.rejects(link('x2'), { constraint: 'expense_items_pkey' })
      await pg.exec('DELETE FROM expense_items')
      await insert('expenses', 'y', { organization_id: "'o2'", vendor: "'가게'", description: "'다과'", amount: '1', paid_on: "'2026-10-09'",
        method: "'cash'", payer_id: "'u'", recorded_by: "'u'" })
      await assert.rejects(link('y'), { constraint: 'expense_items_expense_same_organization' })
      await assert.rejects(link('y', 'o2'), { constraint: 'expense_items_item_same_organization' })
    })
    await t.test('receipts keep a known type, a bounded size and a confirmation time when ready', async () => {
      const receipt = (id: string, change: Record<string, string> = {}) => insert('expense_receipts', id, { organization_id: "'o'",
        expense_id: "'x1'", object_key: `'receipts/o/x1/${id}'`, file_name: "'영수증.jpg'", content_type: "'image/jpeg'", size_bytes: '1234',
        kind: "'receipt'", status: "'pending'", uploaded_by: "'u'", confirmed_at: 'NULL', ...change })
      await receipt('r1')
      await receipt('r2', { status: "'ready'", confirmed_at: 'now()' })
      const cases: [Record<string, string>, string][] = [
        [{ object_key: "'receipts/o/x1/r1'" }, 'expense_receipts_object_key_unique'],
        [{ object_key: `'${'k'.repeat(301)}'` }, 'expense_receipts_object_key_length'],
        [{ file_name: "' '" }, 'expense_receipts_file_name_not_blank'],
        [{ file_name: `'${'가'.repeat(201)}'` }, 'expense_receipts_file_name_length'],
        [{ content_type: "'image/gif'" }, 'expense_receipts_content_type_valid'],
        [{ size_bytes: '0' }, 'expense_receipts_size_range'],
        [{ size_bytes: '10485761' }, 'expense_receipts_size_range'],
        [{ kind: "'invoice'" }, 'expense_receipts_kind_valid'],
        [{ status: "'done'" }, 'expense_receipts_status_valid'],
        [{ status: "'ready'" }, 'expense_receipts_ready_confirmed'],
        [{ expense_id: "'y'" }, 'expense_receipts_expense_same_organization'],
      ]
      for (const [index, [change, constraint]] of cases.entries()) {
        await assert.rejects(receipt(`bad-${index}`, change), { constraint }, constraint)
      }
    })
    await t.test('history actions are known and changes are objects', async () => {
      const entry = (id: string, action: string, changes = "'{}'") => insert('expense_events', id, { organization_id: "'o'",
        expense_id: "'x1'", actor_id: "'u'", action: `'${action}'`, changes })
      await entry('h1', 'created')
      await assert.rejects(entry('h2', 'deleted'), { constraint: 'expense_events_action_valid' })
      await assert.rejects(entry('h3', 'updated', "'[]'"), { constraint: 'expense_events_changes_object' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})

test('0016 adds event finances without touching expenses', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0016_event_settlement')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO expenses (id,organization_id,event_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
        VALUES ('x','o','e','쿠팡','물품',1000,'2026-10-09','council_card','u','u');
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM expenses')).rows
    await migrate(db, { migrationsFolder })
    const finance = (change: Record<string, string> = {}) => {
      const values: Record<string, string> = { event_id: "'e'", organization_id: "'o'", budget: 'NULL', settled_at: 'NULL', settled_by: 'NULL', ...change }
      return pg.exec(`INSERT INTO event_finances (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)
    }

    await t.test('existing expenses keep their values', async () => {
      // 0017이 더한 칸(budget_line_id)은 빼고 원래 칸만 비교한다.
      assert.deepEqual(sameColumns((await pg.query<Record<string, unknown>>('SELECT * FROM expenses')).rows, before), before)
    })
    await t.test('a budget is zero or more, who and when settle together, and the event is in the same council', async () => {
      await finance({ budget: '0', settled_at: 'now()', settled_by: "'u'" })
      await assert.rejects(finance(), { constraint: 'event_finances_pkey' })
      await pg.exec('DELETE FROM event_finances')
      await finance()
      await pg.exec('DELETE FROM event_finances')
      const cases: [Record<string, string>, string][] = [
        [{ budget: '-1' }, 'event_finances_budget_nonnegative'],
        [{ settled_at: 'now()' }, 'event_finances_settled_pair'],
        [{ settled_by: "'u'" }, 'event_finances_settled_pair'],
        [{ version: '0' }, 'event_finances_version_positive'],
        [{ event_id: "'e2'" }, 'event_finances_event_same_organization'],
      ]
      for (const [change, constraint] of cases) await assert.rejects(finance(change), { constraint }, constraint)
    })
    await t.test('history actions are known, changes are objects, and only reopening has a short reason', async () => {
      const entry = (id: string, action: string, reason = 'NULL', changes = "'{}'", event = 'e') => pg.exec(
        `INSERT INTO event_finance_events (id,organization_id,event_id,actor_id,action,changes,reason) VALUES ('${id}','o','${event}','u','${action}',${changes},${reason})`)
      await entry('h1', 'budget_set', 'NULL', `'{"from":null,"to":1000}'`)
      await entry('h2', 'settled')
      await entry('h3', 'reopened', "'영수증 빠짐'")
      const cases: [string, string, string, string][] = [
        ['h4', 'closed', 'NULL', 'event_finance_events_action_valid'],
        ['h5', 'reopened', 'NULL', 'event_finance_events_reason_when_reopened'],
        ['h6', 'settled', "'사유'", 'event_finance_events_reason_when_reopened'],
        ['h7', 'reopened', "'  '", 'event_finance_events_reason_not_blank'],
        ['h8', 'reopened', `'${'가'.repeat(201)}'`, 'event_finance_events_reason_length'],
      ]
      for (const [id, action, reason, constraint] of cases) await assert.rejects(entry(id, action, reason), { constraint }, constraint)
      await assert.rejects(entry('h9', 'settled', 'NULL', "'[]'"), { constraint: 'event_finance_events_changes_object' })
      await assert.rejects(entry('h10', 'settled', 'NULL', "'{}'", 'e2'), { constraint: 'event_finance_events_event_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})

test('0017 adds budget plans and an optional operating line on expenses', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0017_budget_plan')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO expenses (id,organization_id,event_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
        VALUES ('x','o','e','쿠팡','물품',1000,'2026-10-09','council_card','u','u'),('y','o',NULL,'다이소','다과',500,'2026-10-09','cash','u','u');
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM expenses ORDER BY id')).rows
    await migrate(db, { migrationsFolder })
    const insert = (table: string, values: Record<string, string>) =>
      pg.exec(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)
    const period = (id: string, change: Record<string, string> = {}) => insert('budget_periods', { id: `'${id}'`, organization_id: "'o'",
      name: `'${id} 기간'`, starts_on: "'2026-09-01'", ends_on: "'2027-02-28'", created_by: "'u'", ...change })
    const line = (id: string, change: Record<string, string> = {}) => insert('budget_lines', { id: `'${id}'`, organization_id: "'o'",
      period_id: "'p'", kind: "'income'", event_id: 'NULL', name: "'학생회비'", amount: '1000', position: '0', ...change })

    await t.test('existing expenses keep their values and have no operating line', async () => {
      const after = (await pg.query<Record<string, unknown>>('SELECT * FROM expenses ORDER BY id')).rows
      assert.deepEqual(sameColumns(after, before), before)
      assert.deepEqual(after.map(row => row.budget_line_id), [null, null])
    })
    await t.test('a period has a short name unique in its council and ordered dates in range', async () => {
      await period('p')
      await period('q', { organization_id: "'o2'", name: "'p 기간'" })
      const cases: [Record<string, string>, string][] = [
        [{ name: "'p 기간'" }, 'budget_periods_organization_name_unique'],
        [{ name: "' '" }, 'budget_periods_name_not_blank'],
        [{ name: `'${'가'.repeat(31)}'` }, 'budget_periods_name_length'],
        [{ starts_on: "'2027-03-01'" }, 'budget_periods_dates_order'],
        [{ starts_on: "'1999-12-31'" }, 'budget_periods_dates_range'],
        [{ ends_on: "'3000-01-01'" }, 'budget_periods_dates_range'],
        [{ version: '0' }, 'budget_periods_version_positive'],
      ]
      for (const [index, [change, constraint]] of cases.entries()) await assert.rejects(period(`bad${index}`, change), { constraint }, constraint)
    })
    await t.test('a line is either a named amount or an event, and an event sits in one period of its council', async () => {
      await line('l1')
      await line('l2', { kind: "'operating'", name: "'회의비'" })
      await line('l3', { kind: "'event'", event_id: "'e'", name: 'NULL', amount: 'NULL' })
      const cases: [Record<string, string>, string][] = [
        [{ kind: "'other'" }, 'budget_lines_kind_valid'],
        [{ kind: "'event'", name: 'NULL', amount: 'NULL' }, 'budget_lines_event_kind'],
        [{ event_id: "'e'" }, 'budget_lines_event_kind'],
        [{ name: 'NULL' }, 'budget_lines_named_kind'],
        [{ amount: 'NULL' }, 'budget_lines_amount_kind'],
        [{ name: "' '" }, 'budget_lines_name_not_blank'],
        [{ name: `'${'가'.repeat(31)}'` }, 'budget_lines_name_length'],
        [{ amount: '-1' }, 'budget_lines_amount_nonnegative'],
        [{ position: '-1' }, 'budget_lines_position_nonnegative'],
        [{ kind: "'event'", event_id: "'e'", name: 'NULL', amount: 'NULL' }, 'budget_lines_event_unique'],
        [{ period_id: "'q'" }, 'budget_lines_period_same_organization'],
        [{ kind: "'event'", event_id: "'e2'", name: 'NULL', amount: 'NULL' }, 'budget_lines_event_same_organization'],
      ]
      for (const [index, [change, constraint]] of cases.entries()) await assert.rejects(line(`bad${index}`, change), { constraint }, constraint)
    })
    await t.test('only an operating expense of the same council points at a line, and a used line is not deleted', async () => {
      await pg.exec("UPDATE expenses SET budget_line_id = 'l2' WHERE id = 'y'")
      await assert.rejects(pg.exec("UPDATE expenses SET budget_line_id = 'l2' WHERE id = 'x'"), { constraint: 'expenses_budget_line_operating_only' })
      await line('lq', { organization_id: "'o2'", period_id: "'q'", kind: "'operating'", name: "'남의 항목'" })
      await assert.rejects(pg.exec("UPDATE expenses SET budget_line_id = 'lq' WHERE id = 'y'"), { constraint: 'expenses_budget_line_same_organization' })
      await assert.rejects(pg.exec("DELETE FROM budget_lines WHERE id = 'l2'"), { constraint: 'expenses_budget_line_same_organization' })
    })
    await t.test('history actions are known, changes are objects, and the period is in the same council', async () => {
      const entry = (id: string, action: string, changes = "'{}'", periodId = 'p') => insert('budget_period_events', { id: `'${id}'`,
        organization_id: "'o'", period_id: `'${periodId}'`, actor_id: "'u'", action: `'${action}'`, changes })
      await entry('h1', 'created')
      await entry('h2', 'updated', `'{"lines":[]}'`)
      await assert.rejects(entry('h3', 'deleted'), { constraint: 'budget_period_events_action_valid' })
      await assert.rejects(entry('h4', 'updated', "'[]'"), { constraint: 'budget_period_events_changes_object' })
      await assert.rejects(entry('h5', 'created', "'{}'", 'q'), { constraint: 'budget_period_events_period_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})

test('0018 adds incomes that belong to a period and optionally an income line', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0018_incomes')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('p','o','2026년 2학기','2026-09-01','2027-02-28','u'),
        ('q','o2','남의 기간','2026-09-01','2027-02-28','u');
      INSERT INTO budget_lines (id,organization_id,period_id,kind,name,amount,position) VALUES ('li','o','p','income','학생회비',800000,0),
        ('lq','o2','q','income','남의 수입',1000,0);
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM budget_lines ORDER BY id')).rows
    await migrate(db, { migrationsFolder })
    const insert = (table: string, values: Record<string, string>) =>
      pg.exec(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)
    const income = (id: string, change: Record<string, string> = {}) => insert('incomes', { id: `'${id}'`, organization_id: "'o'", period_id: "'p'",
      budget_line_id: "'li'", description: "'학생회비 입금'", amount: '750000', received_on: "'2026-09-15'", note: 'NULL', recorded_by: "'u'", ...change })

    await t.test('existing budget lines keep their values', async () => {
      assert.deepEqual((await pg.query<Record<string, unknown>>('SELECT * FROM budget_lines ORDER BY id')).rows, before)
    })
    await t.test('an income has short text, a positive amount, a date in range and a complete void', async () => {
      await income('i1')
      await income('i2', { budget_line_id: 'NULL', note: "'메모'" })
      await income('i3', { voided_at: 'now()', voided_by: "'u'", void_reason: "'중복'" })
      const cases: [Record<string, string>, string][] = [
        [{ description: "' '" }, 'incomes_description_not_blank'],
        [{ description: `'${'가'.repeat(101)}'` }, 'incomes_description_length'],
        [{ amount: '0' }, 'incomes_amount_positive'],
        [{ received_on: "'1999-12-31'" }, 'incomes_received_on_range'],
        [{ received_on: "'3000-01-01'" }, 'incomes_received_on_range'],
        [{ note: "' '" }, 'incomes_note_not_blank'],
        [{ note: `'${'가'.repeat(201)}'` }, 'incomes_note_length'],
        [{ version: '0' }, 'incomes_version_positive'],
        [{ voided_at: 'now()' }, 'incomes_void_triple'],
        [{ voided_by: "'u'", void_reason: "'중복'" }, 'incomes_void_triple'],
        [{ voided_at: 'now()', voided_by: "'u'", void_reason: "' '" }, 'incomes_void_reason_not_blank'],
        [{ voided_at: 'now()', voided_by: "'u'", void_reason: `'${'가'.repeat(201)}'` }, 'incomes_void_reason_length'],
        [{ period_id: "'q'" }, 'incomes_period_same_organization'],
        [{ budget_line_id: "'lq'" }, 'incomes_budget_line_same_organization'],
      ]
      for (const [index, [change, constraint]] of cases.entries()) await assert.rejects(income(`bad${index}`, change), { constraint }, constraint)
    })
    await t.test('a line chosen by an income is not deleted', async () => {
      await assert.rejects(pg.exec("DELETE FROM budget_lines WHERE id = 'li'"), { constraint: 'incomes_budget_line_same_organization' })
    })
    await t.test('history actions are known, changes are objects, and the income is in the same council', async () => {
      const entry = (id: string, action: string, changes = "'{}'", organization = 'o') => insert('income_events', { id: `'${id}'`,
        organization_id: `'${organization}'`, income_id: "'i1'", actor_id: "'u'", action: `'${action}'`, changes })
      await entry('h1', 'created')
      await entry('h2', 'updated', `'{"amount":{"from":1,"to":2}}'`)
      await entry('h3', 'voided', `'{"reason":"중복"}'`)
      await assert.rejects(entry('h4', 'deleted'), { constraint: 'income_events_action_valid' })
      await assert.rejects(entry('h5', 'updated', "'[]'"), { constraint: 'income_events_changes_object' })
      await assert.rejects(entry('h6', 'created', "'{}'", 'o2'), { constraint: 'income_events_income_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})

test('0019 adds period closing, reopen reasons and carried-over incomes without touching existing rows', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0019_period_close')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('p','o','2025년 2학기','2025-09-01','2026-02-28','u'),
        ('n','o','2026년 1학기','2026-03-01','2026-08-31','u'),('q','o2','남의 기간','2025-09-01','2026-02-28','u');
      INSERT INTO incomes (id,organization_id,period_id,description,amount,received_on,recorded_by) VALUES ('i','o','p','학생회비',750000,'2025-09-15','u');
      INSERT INTO budget_period_events (id,organization_id,period_id,actor_id,action,changes) VALUES ('h','o','p','u','created','{}');
    `)
    const tables = ['budget_periods', 'incomes', 'budget_period_events']
    const before = await Promise.all(tables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
    await migrate(db, { migrationsFolder })
    const insert = (table: string, values: Record<string, string>) =>
      pg.exec(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)

    await t.test('existing periods, incomes and history keep their values and the new columns are empty', async () => {
      const after = await Promise.all(tables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
      assert.deepEqual(after.map((result, index) => sameColumns(result.rows, before[index]!.rows)), before.map(result => result.rows))
      assert.deepEqual(after.map(result => result.rows.map(row => [row.closed_at, row.closed_by, row.carried_from_period_id, row.reason]
        .filter(value => value !== undefined))), [[[null, null], [null, null], [null, null]], [[null]], [[null]]])
    })
    await t.test('a period is closed with both the time and the person or neither', async () => {
      await pg.exec("UPDATE budget_periods SET closed_at = now(), closed_by = 'u' WHERE id = 'p'")
      await assert.rejects(pg.exec("UPDATE budget_periods SET closed_at = now() WHERE id = 'n'"), { constraint: 'budget_periods_closed_pair' })
      await assert.rejects(pg.exec("UPDATE budget_periods SET closed_by = 'u' WHERE id = 'n'"), { constraint: 'budget_periods_closed_pair' })
    })
    await t.test('history knows closed and reopened, and only reopened keeps a short non-blank reason', async () => {
      const entry = (id: string, action: string, reason = 'NULL') => insert('budget_period_events', { id: `'${id}'`, organization_id: "'o'",
        period_id: "'p'", actor_id: "'u'", action: `'${action}'`, changes: `'{"balance":0}'`, reason })
      await entry('h1', 'closed')
      await entry('h2', 'reopened', "'영수증 빠짐'")
      const cases: [string, string, string][] = [
        ['h3', 'reopened', 'budget_period_events_reason_when_reopened'],
        ['h4', 'created', 'budget_period_events_reason_when_reopened'],
        ['h5', 'reopened', 'budget_period_events_reason_not_blank'],
        ['h6', 'reopened', 'budget_period_events_reason_length'],
        ['h7', 'deleted', 'budget_period_events_action_valid'],
      ]
      const reasons: Record<string, string> = { h3: 'NULL', h4: "'사유'", h5: "' '", h6: `'${'가'.repeat(201)}'`, h7: 'NULL' }
      for (const [id, action, constraint] of cases) await assert.rejects(entry(id, action, reasons[id]), { constraint }, constraint)
    })
    await t.test('a carried-over income comes from another period of the same council, once while not voided', async () => {
      const income = (id: string, change: Record<string, string> = {}) => insert('incomes', { id: `'${id}'`, organization_id: "'o'", period_id: "'n'",
        description: "'2025년 2학기 이월금'", amount: '88000', received_on: "'2026-03-01'", recorded_by: "'u'", carried_from_period_id: "'p'", ...change })
      await income('c1')
      await assert.rejects(income('c2'), { constraint: 'incomes_carried_from_active_unique' })
      await assert.rejects(income('c3', { carried_from_period_id: "'n'" }), { constraint: 'incomes_carried_from_other_period' })
      await assert.rejects(income('c4', { carried_from_period_id: "'q'" }), { constraint: 'incomes_carried_from_same_organization' })
      await pg.exec("UPDATE incomes SET voided_at = now(), voided_by = 'u', void_reason = '다시 엶' WHERE id = 'c1'")
      await income('c5')
      // 이월금만 가리키는 기간도 지울 수 없다.
      await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('r','o','2025년 1학기','2025-03-01','2025-08-31','u')`)
      await income('c6', { carried_from_period_id: "'r'" })
      await assert.rejects(pg.exec("DELETE FROM budget_periods WHERE id = 'r'"), { constraint: 'incomes_carried_from_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})

test('0020 adds event times, registration forms and registrations without touching existing events', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0020_event_registration')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u'),('e3','o','축제','u');
    `)
    const before = await pg.query<Record<string, unknown>>('SELECT * FROM events ORDER BY id')
    await migrate(db, { migrationsFolder })
    const insert = (table: string, values: Record<string, string>) =>
      pg.exec(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)

    await t.test('existing events keep their values and the new columns are empty', async () => {
      const after = await pg.query<Record<string, unknown>>('SELECT * FROM events ORDER BY id')
      assert.deepEqual(sameColumns(after.rows, before.rows), before.rows)
      assert.deepEqual(after.rows.map(row => [row.starts_at, row.ends_at, row.place, row.version]),
        [[null, null, null, 1], [null, null, null, 1], [null, null, null, 1]])
    })
    await t.test('an event ends after it starts, stays in range and has a short non-blank place', async () => {
      await pg.exec("UPDATE events SET starts_at = '2026-08-20T10:00+09', ends_at = '2026-08-20T18:00+09', place = '체육관' WHERE id = 'e'")
      const cases: [string, string][] = [
        ['starts_at = NULL', 'events_ends_after_start'],
        ["ends_at = '2026-08-20T10:00+09'", 'events_ends_after_start'],
        ["ends_at = '2026-08-20T09:00+09'", 'events_ends_after_start'],
        ["starts_at = '1999-12-31T10:00+09', ends_at = NULL", 'events_time_range'],
        ["place = ' '", 'events_place_not_blank'],
        [`place = '${'가'.repeat(101)}'`, 'events_place_length'],
        ['version = 0', 'events_version_positive'],
      ]
      for (const [change, constraint] of cases) await assert.rejects(pg.exec(`UPDATE events SET ${change} WHERE id = 'e'`), { constraint }, change)
    })
    const form = (id: string, change: Record<string, string> = {}) => insert('registration_forms', { id: `'${id}'`, organization_id: "'o'",
      event_id: "'e'", closes_at: "'2026-08-19T23:59+09'", created_by: "'u'", ...change })
    await t.test('a registration form belongs to one event of the same council with a valid code, window, capacity and notice', async () => {
      await form('f')
      const { rows: [row] } = await pg.query<{ code: string; accepting: boolean; collect_phone: boolean; version: number; capacity: number | null }>(
        "SELECT code, accepting, collect_phone, version, capacity FROM registration_forms WHERE id = 'f'")
      assert.match(row!.code, /^[2-9A-HJ-NP-Z]{8}$/)
      assert.deepEqual([row!.accepting, row!.collect_phone, row!.version, row!.capacity], [true, false, 1, null])
      await assert.rejects(form('f2'), { constraint: 'registration_forms_event_id_unique' })
      await assert.rejects(form('f3', { event_id: "'e2'" }), { constraint: 'registration_forms_event_same_organization' })
      const cases: [Record<string, string>, string][] = [
        [{ opens_at: "'2026-08-19T23:59+09'" }, 'registration_forms_opens_before_closes'],
        [{ opens_at: "'2026-08-20T00:00+09'" }, 'registration_forms_opens_before_closes'],
        [{ closes_at: "'1999-12-31T23:59+09'" }, 'registration_forms_time_range'],
        [{ capacity: '0' }, 'registration_forms_capacity_range'],
        [{ capacity: '5001' }, 'registration_forms_capacity_range'],
        [{ notice: "' '" }, 'registration_forms_notice_not_blank'],
        [{ notice: `'${'가'.repeat(1001)}'` }, 'registration_forms_notice_length'],
        [{ code: "'abc'" }, 'registration_forms_code_format'],
        [{ version: '0' }, 'registration_forms_version_positive'],
      ]
      for (const [change, constraint] of cases) await assert.rejects(form('f4', { event_id: "'e3'", ...change }), { constraint }, constraint)
      await form('f5', { event_id: "'e3'", opens_at: "'2026-08-01T10:00+09'", capacity: '5000', notice: `'${'가'.repeat(1000)}'`, collect_phone: 'true' })
    })
    await t.test('a registration is live with token, name and student id, or purged with all four empty', async () => {
      await insert('registration_forms', { id: "'fx'", organization_id: "'o2'", event_id: "'e2'", closes_at: "'2026-08-19T23:59+09'", created_by: "'u'" })
      const hash = (n: number) => `'${n.toString(16).padStart(64, '0')}'`
      const live = (id: string, n: number, change: Record<string, string> = {}) => insert('registrations', { id: `'${id}'`, organization_id: "'o'",
        form_id: "'f'", token_hash: hash(n), name: "'김바다'", student_id: `'${2022000000 + n}'`, ...change })
      const purged = (id: string, change: Record<string, string> = {}) => insert('registrations', { id: `'${id}'`, organization_id: "'o'",
        form_id: "'f'", purged_at: 'now()', ...change })
      await live('r1', 1, { phone: "'01012345678'" })
      await purged('r2')
      await purged('r3', { cancelled_at: 'now()', cancelled_by: "'u'" })
      // 지운 행끼리는 학번이 없으므로 겹치지 않는다.
      await purged('r4')
      const cases: [() => Promise<unknown>, string][] = [
        [() => live('x1', 2, { name: 'NULL' }), 'registrations_purged_state'],
        [() => live('x2', 3, { purged_at: 'now()' }), 'registrations_purged_state'],
        [() => purged('x3', { phone: "'01012345678'" }), 'registrations_purged_state'],
        [() => live('x4', 4, { cancelled_at: 'now()' }), 'registrations_cancel_purges'],
        [() => purged('x5', { cancelled_by: "'u'" }), 'registrations_cancelled_pair'],
        [() => live('x6', 5, { token_hash: "'xyz'" }), 'registrations_token_hash_format'],
        [() => live('x7', 6, { name: "' '" }), 'registrations_name_not_blank'],
        [() => live('x8', 7, { name: `'${'가'.repeat(31)}'` }), 'registrations_name_length'],
        [() => live('x9', 8, { student_id: "'abc'" }), 'registrations_student_id_format'],
        [() => live('x10', 9, { student_id: "'12345'" }), 'registrations_student_id_format'],
        [() => live('x11', 10, { phone: "'0212345678'" }), 'registrations_phone_format'],
        [() => live('x12', 11, { student_id: "'2022000001'" }), 'registrations_form_student_active_unique'],
        [() => live('x13', 1, { student_id: "'2022999999'" }), 'registrations_token_hash_unique'],
        [() => live('x14', 12, { form_id: "'fx'" }), 'registrations_form_same_organization'],
      ]
      for (const [run, constraint] of cases) await assert.rejects(run(), { constraint }, constraint)
      // 신청이 있는 신청 설정과 행사는 지울 수 없다.
      await assert.rejects(pg.exec("DELETE FROM registration_forms WHERE id = 'f'"), { constraint: 'registrations_form_same_organization' })
      await assert.rejects(pg.exec("DELETE FROM events WHERE id = 'e'"), { constraint: 'registration_forms_event_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})
