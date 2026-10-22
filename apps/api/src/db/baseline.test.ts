import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { FILE_NAME_MAX, MESSAGE_BODY_MAX } from '@vada/contracts'
import { createTestDb, migrationsFolder } from './test-db.js'

// 기록과 하위 행을 함께 넣는다(vada-docs tools/schema-check/setup.mjs의 recorder와 같다). 기록 모듈은 다음 작업에서 만든다.
const COUNCIL_COLUMN = new Set(['cohort', 'department'])
async function add(
  pg: PGlite,
  kind: string,
  council: string | null,
  fields: Record<string, unknown>,
) {
  const { rows } = await pg.query<{ id: string }>(
    'INSERT INTO record (kind, council_id) VALUES ($1, $2) RETURNING id',
    [kind, council],
  )
  const row: Record<string, unknown> = {
    id: rows[0]!.id,
    ...(COUNCIL_COLUMN.has(kind) ? { council_id: council } : {}),
    ...fields,
  }
  const columns = Object.keys(row)
  await pg.query(
    `INSERT INTO ${kind} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  )
  return rows[0]!.id
}

async function seed(pg: PGlite) {
  const council = await add(pg, 'council', null, {
    name: '컴퓨터학부 학생회',
    unit: 'department',
    school_name: '한양대학교 ERICA',
  })
  const cohort = await add(pg, 'cohort', council, {
    name: '2026',
    starts_on: '2026-01-01',
    ends_on: '2026-12-31',
  })
  const member = (name: string) => add(pg, 'member', null, { name, email: `${name}@example.test` })
  return { council, cohort, member }
}

test('첫 마이그레이션은 설계 표 45개와 로그인 표 4개, 설계 밖 표 5개를 만든다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    )
    const names = rows.map(row => row.table_name)
    assert.equal(names.length, 55)
    for (const name of [
      'users',
      'accounts',
      'sessions',
      'verifications',
      'member_login',
      'invite_code',
      'push_device',
      'terms_agreement',
      'registration_link',
      'applicant_access_log',
      'record',
      'record_version',
      'council',
      'cohort',
      'member',
      'council_membership',
      'department',
      'department_membership',
    ])
      assert.ok(names.includes(name), name)
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] }
    assert.deepEqual(
      journal.entries.map(entry => entry.tag),
      [
        '0000_baseline',
        '0001_chat_limits',
        '0002_task_cancelled_at',
        '0003_task_limits',
        '0004_purchase_limits',
        '0005_event_account_limits',
        '0006_terms_agreement',
        '0007_registration_limits',
        '0008_registration_attendance',
        '0009_settlement_columns',
        '0010_deposit_unique',
        '0011_income_limits_carryover_unique',
      ],
    )
    assert.equal((await pg.query('SELECT id FROM drizzle.__drizzle_migrations')).rows.length, 12)
  } finally {
    await close()
  }
})

test('첫 마이그레이션 파일은 LF이고, 조각마다 문장이 하나다', () => {
  const sql = readFileSync(join(migrationsFolder, '0000_baseline.sql'), 'utf8')
  assert.ok(!sql.includes('\r'))
  const pieces = sql.split('--> statement-breakpoint')
  // 로그인 9문장 + 설계 104문장 + 설계 밖 5문장
  assert.equal(pieces.length, 118)
  for (const piece of pieces) {
    const ends = piece.split('\n').filter(line => !/^\s*--/.test(line) && /;\s*(--.*)?$/.test(line))
    assert.equal(ends.length, 1, piece)
  }
})

test('DB가 한 기수의 회장 둘을 막고, 끝난 회장 뒤의 새 회장은 받는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council, cohort, member } = await seed(pg)
    const first = await member('first')
    const second = await member('second')
    const president = (who: string) =>
      add(pg, 'council_membership', council, {
        member_id: who,
        cohort_id: cohort,
        council_rank: 'president',
        starts_at: '2026-01-02',
      })
    await president(first)
    await assert.rejects(president(second), { code: '23505' })
    await pg.query("UPDATE council_membership SET ends_at = '2026-06-01' WHERE member_id = $1", [
      first,
    ])
    await president(second)
  } finally {
    await close()
  }
})

test('DB가 같은 기록의 판 기간이 겹치는 것을 막고, 이어 붙은 판은 받는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council } = await seed(pg)
    const version = (no: number, range: string) =>
      pg.query(
        `INSERT INTO record_version (record_id, version_no, valid, data) VALUES ($1, $2, ${range}, '{}')`,
        [council, no],
      )
    await version(1, "tstzrange('2026-01-01', '2026-02-01')")
    await assert.rejects(version(2, "tstzrange('2026-01-15', NULL)"), { code: '23P01' })
    await version(2, "tstzrange('2026-02-01', NULL)")
  } finally {
    await close()
  }
})

test('DB가 초대 코드 형식(2~9와 I·O를 뺀 대문자 8자)만 받고, 같은 코드를 두 학생회에 주지 않는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council, member } = await seed(pg)
    const other = await add(pg, 'council', null, {
      name: '경영학부 학생회',
      unit: 'department',
      school_name: '한양대학교 ERICA',
    })
    const creator = await member('creator')
    const insert = (to: string, code: string) =>
      pg.query('INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)', [
        to,
        code,
        creator,
      ])
    for (const code of [
      'abcd2345',
      'ABCD234',
      'ABCD23456',
      'ABCD234O',
      'ABCD234I',
      'ABCD2340',
      'ABCD2341',
      'ABCD 234',
    ]) {
      await assert.rejects(insert(council, code), { code: '23514' }, code)
    }
    await insert(council, 'ABCD2345')
    await assert.rejects(insert(other, 'ABCD2345'), { code: '23505' })
    await assert.rejects(insert(council, 'WXYZ6789'), { code: '23505' })
  } finally {
    await close()
  }
})

test('DB가 이름 칸의 길이 상한을 막는다(계약과 같은 값: 학생회 이름·학교 50, 직급 표시 이름·기수·부서 이름 20, 이모지도 한 글자)', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council } = await seed(pg)
    const name = (length: number) => `${'가'.repeat(length - 1)}😀`
    await assert.rejects(
      add(pg, 'council', null, { name: name(51), unit: 'department', school_name: '학교' }),
      { code: '23514' },
    )
    await assert.rejects(
      add(pg, 'council', null, { name: '학생회', unit: 'department', school_name: name(51) }),
      { code: '23514' },
    )
    await add(pg, 'council', null, { name: name(50), unit: 'department', school_name: name(50) })
    for (const column of [
      'president_title',
      'vice_president_title',
      'head_title',
      'vice_head_title',
    ]) {
      await assert.rejects(
        pg.query(`UPDATE council SET ${column} = $1 WHERE id = $2`, [name(21), council]),
        { code: '23514' },
        column,
      )
    }
    await assert.rejects(
      add(pg, 'cohort', council, {
        name: name(21),
        starts_on: '2027-01-01',
        ends_on: '2027-12-31',
      }),
      { code: '23514' },
    )
    await assert.rejects(add(pg, 'department', council, { name: name(21) }), { code: '23514' })
    await add(pg, 'department', council, { name: name(20) })
  } finally {
    await close()
  }
})

test('DB가 로그인 계정 하나를 운영진 둘에 잇거나 운영진 하나를 두 계정에 잇는 것을 막는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { member } = await seed(pg)
    const kim = await member('kim')
    const lee = await member('lee')
    await pg.query(
      "INSERT INTO users (id, name, email) VALUES ('u1', '김', 'kim@example.test'), ('u2', '이', 'lee@example.test')",
    )
    await pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u1')", [kim])
    await assert.rejects(
      pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u1')", [lee]),
      { code: '23505' },
    )
    await assert.rejects(
      pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u2')", [kim]),
      { code: '23505' },
    )
    // 로그인 계정을 지우면 잇기만 지운다. 운영진 기록은 남는다.
    await pg.query("DELETE FROM users WHERE id = 'u1'")
    assert.equal((await pg.query('SELECT * FROM member_login')).rows.length, 0)
    assert.equal((await pg.query('SELECT * FROM member WHERE id = $1', [kim])).rows.length, 1)
  } finally {
    await close()
  }
})

test('DB가 메시지 본문 2000자와 파일 이름 200자까지만 받는다(계약과 같은 값, 이모지도 한 글자)', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council } = await seed(pg)
    const room = await add(pg, 'chat_room', council, { type: 'all_members' })
    const text = (length: number) => `${'가'.repeat(length - 1)}😀`
    const message = (body: string) =>
      add(pg, 'message', council, { room_id: room, body, sent_at: '2026-02-01T00:00:00Z' })
    const file = (name: string, key: string) =>
      add(pg, 'file', council, {
        name,
        media_type: 'image/jpeg',
        size_bytes: 1,
        storage_key: key,
      })
    await assert.rejects(message(text(MESSAGE_BODY_MAX + 1)), { code: '23514' })
    await message(text(MESSAGE_BODY_MAX))
    await assert.rejects(file(text(FILE_NAME_MAX + 1), 'k1'), { code: '23514' })
    await file(text(FILE_NAME_MAX), 'k2')
  } finally {
    await close()
  }
})
