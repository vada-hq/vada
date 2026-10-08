import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

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
    assert.deepEqual((await pg.query('SELECT * FROM events')).rows, before)
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
    await t.test('membership and purchase request may have no department, but a set one must match the council', async () => {
      await pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m2','u2','org1',NULL)")
      await assert.rejects(pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m3','u2','org2','d1')"),
        { code: '23503', constraint: 'memberships_department_same_organization' })
      await pg.exec(`
        INSERT INTO events (id,organization_id,name,created_by) VALUES ('e1','org1','Festival','u2');
        INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,department_id,idempotency_key) VALUES ('r1','org1','e1','u2',NULL,'k1');
      `)
      const request = await pg.query<{ department_id: string | null }>("SELECT department_id FROM purchase_requests WHERE id = 'r1'")
      assert.equal(request.rows[0]?.department_id, null)
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
