import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsFolder } from '../db/test-migrations.js'
import { createRegistrationPurger, purgeExpired } from './purge.js'
import { eventEnd, purgeAfterOf, stateOf } from './state.js'

const at = (value: string) => new Date(`${value}:00+09:00`)
const form = { accepting: true, opensAt: at('2026-08-01T10:00'), closesAt: at('2026-08-19T23:59'), capacity: 2 }

test('신청 상태: 마감 → 멈춤 → 시작 전 → 정원 참 → 받는 중 순서로 먼저 맞는 것이다', () => {
  // 시작·마감 시각 정각: 시작 시각부터 받고, 마감 시각부터 닫는다.
  assert.equal(stateOf(form, 0, at('2026-08-01T10:00')), 'open')
  assert.equal(stateOf(form, 0, at('2026-08-01T09:59')), 'upcoming')
  assert.equal(stateOf(form, 0, at('2026-08-19T23:58')), 'open')
  assert.equal(stateOf(form, 0, at('2026-08-19T23:59')), 'closed')
  assert.equal(stateOf(form, 1, at('2026-08-10T10:00')), 'open')
  assert.equal(stateOf(form, 2, at('2026-08-10T10:00')), 'full')
  assert.equal(stateOf(form, 3, at('2026-08-10T10:00')), 'full')
  assert.equal(stateOf({ ...form, capacity: null }, 5000, at('2026-08-10T10:00')), 'open')
  assert.equal(stateOf({ ...form, opensAt: null }, 0, at('2020-01-01T00:00')), 'open')
  // 멈춤이어도 마감이 지났으면 마감이고, 시작 전이어도 멈췄으면 멈춤이다. 정원이 찼어도 시작 전이면 시작 전이다.
  const paused = { ...form, accepting: false }
  assert.equal(stateOf(paused, 0, at('2026-08-20T00:00')), 'closed')
  assert.equal(stateOf(paused, 0, at('2026-07-01T00:00')), 'paused')
  assert.equal(stateOf(paused, 2, at('2026-08-10T10:00')), 'paused')
  assert.equal(stateOf(form, 2, at('2026-07-01T00:00')), 'upcoming')
})

test('행사 끝과 지울 때: 끝 일시가 없으면 시작 일시가 끝이고, 30일 뒤에 지운다', () => {
  assert.equal(eventEnd({ startsAt: null, endsAt: null }), null)
  assert.deepEqual(eventEnd({ startsAt: at('2026-08-20T10:00'), endsAt: null }), at('2026-08-20T10:00'))
  assert.deepEqual(eventEnd({ startsAt: at('2026-08-20T10:00'), endsAt: at('2026-08-21T12:00') }), at('2026-08-21T12:00'))
  assert.deepEqual(purgeAfterOf(at('2026-08-20T18:00')), at('2026-09-19T18:00'))
})

// 행사 a(끝 2024-01-01)와 b(시작만 2024-01-01)는 지울 때가 지났고, c(2999년)는 아니다.
// 신청마다 살아 있는 신청 둘(하나는 휴대폰 있음)과 취소해 이미 지운 신청 하나가 있다.
async function setup() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder })
  await pg.exec(`
    INSERT INTO users (id,name,email) VALUES ('u','기획','u@test.local');
    INSERT INTO organizations (id,name) VALUES ('o','A');
    INSERT INTO events (id,organization_id,name,created_by,starts_at,ends_at) VALUES
      ('a','o','지난 행사','u','2023-12-31T10:00+09','2024-01-01T10:00+09'),
      ('b','o','시작만 있는 지난 행사','u','2024-01-01T10:00+09',NULL),
      ('c','o','먼 행사','u','2999-01-01T10:00+09',NULL);
    INSERT INTO registration_forms (id,organization_id,event_id,closes_at,created_by) VALUES
      ('fa','o','a','2023-12-30T10:00+09','u'),('fb','o','b','2023-12-30T10:00+09','u'),('fc','o','c','2998-12-30T10:00+09','u');
  `)
  let n = 0
  for (const formId of ['fa', 'fb', 'fc']) {
    for (const phone of ['NULL', "'01012345678'"]) {
      n++
      await pg.exec(`INSERT INTO registrations (id,organization_id,form_id,token_hash,name,student_id,phone)
        VALUES ('${formId}-${n}','o','${formId}','${n.toString(16).padStart(64, '0')}','신청자','${2022000000 + n}',${phone})`)
    }
    await pg.exec(`INSERT INTO registrations (id,organization_id,form_id,cancelled_at,purged_at)
      VALUES ('${formId}-cancelled','o','${formId}','2023-12-01T00:00Z','2023-12-01T00:00Z')`)
  }
  return { pg, db }
}
type Row = { id: string; token_hash: string | null; name: string | null; student_id: string | null; phone: string | null; purged_at: Date | null;
  cancelled_at: Date | null }
const rowsOf = async (pg: PGlite) => (await pg.query<Row>('SELECT * FROM registrations ORDER BY id')).rows

test('파기: 행사 끝에서 30일이 지난 신청의 개인 칸을 지우고, 신청 행과 취소 기록은 남긴다', async () => {
  const { pg, db } = await setup()
  try {
    const before = await rowsOf(pg)
    assert.equal(await purgeExpired(db), 4)
    const after = await rowsOf(pg)
    assert.equal(after.length, before.length)
    for (const row of after) {
      const old = before.find(item => item.id === row.id)!
      if (row.id.endsWith('cancelled')) assert.deepEqual(row, old, row.id)
      else if (row.id.startsWith('fc')) assert.deepEqual(row, old, row.id)
      else {
        assert.deepEqual([row.token_hash, row.name, row.student_id, row.phone, row.cancelled_at], [null, null, null, null, null], row.id)
        assert.ok(row.purged_at instanceof Date, row.id)
      }
    }
    assert.equal(await purgeExpired(db), 0)
  } finally { await pg.close() }
})

test('파기: 신청 하나만 지울 수 있다', async () => {
  const { pg, db } = await setup()
  try {
    assert.equal(await purgeExpired(db, 'fb'), 2)
    const live = (await rowsOf(pg)).filter(row => row.purged_at === null).map(row => row.id)
    assert.deepEqual(live, ['fa-1', 'fa-2', 'fc-5', 'fc-6'])
    assert.equal(await purgeExpired(db, 'fc'), 0)
  } finally { await pg.close() }
})

test('파기 실행기: 켜면 바로 한 번 돌고, 실패는 알리기만 하고 밖으로 던지지 않는다', async () => {
  const { pg, db } = await setup()
  try {
    let failures = 0
    const purger = createRegistrationPurger(db, { onFailure: () => { failures++ } })
    const stop = purger.start(3_600_000)
    await purger.run()
    stop()
    assert.equal((await rowsOf(pg)).filter(row => row.purged_at === null).length, 2)
    assert.equal(failures, 0)
    const broken = createRegistrationPurger({ update: () => { throw new Error('db down') } } as never, { onFailure: () => { failures++ } })
    await broken.run()
    assert.equal(failures, 1)
  } finally { await pg.close() }
})

test('파기 실행기: 쓰는 기한이 지난 학생회비 명단도 지운다', async () => {
  const { pg, db } = await setup()
  try {
    await pg.exec(`
      INSERT INTO organizations (id,name) VALUES ('o2','B');
      INSERT INTO dues_rosters (organization_id,label,use_until,uploaded_by) VALUES ('o','지난 명단','2024-01-01','u'),('o2','먼 명단','2999-12-31','u');
      INSERT INTO dues_members (organization_id,student_id,name) VALUES ('o','2022000001','김바다'),('o2','2022000001','김바다');
    `)
    await createRegistrationPurger(db).run()
    const rosters = await pg.query<{ organization_id: string }>('SELECT organization_id FROM dues_rosters ORDER BY organization_id')
    assert.deepEqual(rosters.rows.map(row => row.organization_id), ['o2'])
    const members = await pg.query<{ organization_id: string }>('SELECT organization_id FROM dues_members ORDER BY organization_id')
    assert.deepEqual(members.rows.map(row => row.organization_id), ['o2'])
  } finally { await pg.close() }
})
