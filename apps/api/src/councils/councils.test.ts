import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACTIONS,
  type CouncilView,
  type CreateCouncilResponse,
  type MyCouncilsResponse,
} from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../test-support/http.js'
import { myCouncils } from './queries.js'
import { createCouncilRoutes } from './routes.js'

// 2026-10-19 12:00 KST
const noon = new Date('2026-10-19T03:00:00Z')
const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  cohortName: '2026',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
}

function appOf(testDb: TestDb, now = noon, db: TestDb['db'] = testDb.db) {
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(db, testSession, () => now),
  })
  return caller(app)
}

test('학생회 만들기는 한 거래로 운영진, 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부, 초대 코드를 만든다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'u1', { name: '김회장', email: 'kim@example.test' })
    const response = await appOf(testDb).post('/api/organizations/create', body, 'u1')
    assert.equal(response.status, 201)
    const { council } = (await response.json()) as CreateCouncilResponse
    assert.deepEqual(
      { ...council, id: undefined },
      { id: undefined, name: '컴퓨터학부 학생회', councilRank: 'president', departments: [] },
    )
    const [creator] = (
      await pg.query<{ member_id: string }>(
        "SELECT member_id FROM member_login WHERE user_id = 'u1'",
      )
    ).rows
    const kinds = await pg.query<{
      kind: string
      council_id: string | null
      created_by: string | null
    }>('SELECT kind, council_id, created_by FROM record ORDER BY created_at, id')
    assert.deepEqual(
      kinds.rows.map(row => row.kind),
      ['member', 'council', 'cohort', 'council_membership', 'department'],
    )
    for (const row of kinds.rows.slice(1)) {
      assert.equal(row.created_by, creator!.member_id, row.kind)
      assert.equal(row.council_id, row.kind === 'council' ? null : council.id, row.kind)
    }
    assert.deepEqual(
      (await pg.query('SELECT name, starts_on::text, ends_on::text FROM cohort')).rows,
      [{ name: '2026', starts_on: '2026-01-01', ends_on: '2026-12-31' }],
    )
    assert.deepEqual(
      (await pg.query('SELECT member_id, council_rank, ends_at FROM council_membership')).rows,
      [{ member_id: creator!.member_id, council_rank: 'president', ends_at: null }],
    )
    assert.deepEqual((await pg.query('SELECT name, role FROM department')).rows, [
      { name: '재정부', role: 'finance' },
    ])
    const codes = await pg.query<{ code: string; created_by: string }>(
      'SELECT code, created_by FROM invite_code WHERE council_id = $1',
      [council.id],
    )
    assert.match(codes.rows[0]!.code, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.equal(codes.rows[0]!.created_by, creator!.member_id)
    assert.equal(
      (await pg.query('SELECT * FROM audit_body UNION ALL SELECT * FROM voting_body')).rows.length,
      0,
    )
    // 기록마다 판 1이 있다.
    assert.deepEqual(
      (
        await pg.query(
          'SELECT count(*)::int AS n FROM record r JOIN record_version v ON v.record_id = r.id AND v.version_no = 1',
        )
      ).rows,
      [{ n: 5 }],
    )
  } finally {
    await testDb.close()
  }
})

test('학생회 만들기 응답은 거래 안에서 만든다: 거래 밖에서 읽지 않아도 201이고, 응답은 내 학생회 목록의 한 줄과 같다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { name: '김회장' })
    const response = await appOf(testDb, noon, withoutReadsOutsideTransaction(testDb.db)).post(
      '/api/organizations/create',
      body,
      'u1',
    )
    assert.equal(response.status, 201)
    const created = (await response.json()) as CreateCouncilResponse
    assert.deepEqual(Object.keys(created), ['council'])
    assert.deepEqual(Object.keys(created.council).sort(), [
      'councilRank',
      'departments',
      'id',
      'name',
    ])
    assert.match(
      created.council.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    assert.deepEqual(
      { ...created.council, id: undefined },
      { id: undefined, name: '컴퓨터학부 학생회', councilRank: 'president', departments: [] },
    )
    assert.deepEqual(
      (await (await appOf(testDb).get('/api/me/councils', 'u1')).json()) as MyCouncilsResponse,
      { councils: [created.council] },
    )
  } finally {
    await testDb.close()
  }
})

test('학생회 만들기 중간에 실패하면 아무것도 남지 않는다', async t => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'u1')
    // 마지막 단계(초대 코드)를 실패시킨다.
    await pg.exec(`CREATE FUNCTION refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'refused'; END $$;
      CREATE TRIGGER refuse BEFORE INSERT ON invite_code FOR EACH ROW EXECUTE FUNCTION refuse();`)
    // 예상하지 못한 실패는 on-error가 로그에 남긴다. 시험 출력에서는 숨긴다.
    t.mock.method(console, 'error', () => {})
    assert.equal((await appOf(testDb).post('/api/organizations/create', body, 'u1')).status, 500)
    for (const table of [
      'record',
      'record_version',
      'member',
      'member_login',
      'council',
      'cohort',
      'council_membership',
      'department',
    ]) {
      assert.equal((await pg.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table)
    }
  } finally {
    await testDb.close()
  }
})

test('내 학생회 목록과 학생회 하나 보기: 만든 사람은 회장이고 조직 칸 권한을 모두 가진다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { name: '김회장' })
    await addUser(testDb.pg, 'u2', { name: '이방문' })
    const api = appOf(testDb)
    const { council } = (await (
      await api.post('/api/organizations/create', body, 'u1')
    ).json()) as CreateCouncilResponse
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u1')).json()) as MyCouncilsResponse,
      { councils: [council] },
    )
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      { councils: [] },
    )
    const response = await api.get(`/api/organizations/${council.id}`, 'u1')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const view = (await response.json()) as CouncilView
    assert.deepEqual(view.council, {
      id: council.id,
      name: '컴퓨터학부 학생회',
      unit: 'department',
      schoolName: '한양대학교 ERICA',
      titles: { president: '회장', vicePresident: '부회장', head: '부장', viceHead: '부부장' },
    })
    assert.deepEqual(
      { ...view.cohort, id: undefined },
      { id: undefined, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    )
    assert.deepEqual(
      { ...view.me, memberId: undefined },
      { memberId: undefined, name: '김회장', councilRank: 'president', departments: [] },
    )
    assert.deepEqual(view.permissions, [...ACTIONS])
  } finally {
    await testDb.close()
  }
})

test('다른 학생회 사람과 운영진이 아닌 사람은 403, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user)
    const api = appOf(testDb)
    const first = (
      (await (
        await api.post('/api/organizations/create', body, 'u1')
      ).json()) as CreateCouncilResponse
    ).council
    await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u2')
    assert.equal((await api.get(`/api/organizations/${first.id}`, 'u2')).status, 403)
    assert.equal((await api.get(`/api/organizations/${first.id}`, 'u3')).status, 403)
    assert.equal((await api.get('/api/organizations/not-a-uuid', 'u1')).status, 403)
    assert.equal((await api.get(`/api/organizations/${first.id}`)).status, 401)
    assert.equal((await api.get('/api/me/councils')).status, 401)
    assert.equal((await api.post('/api/organizations/create', body)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('학생회 만들기 입력: 빠진 값, 빈 값, 상한+1, NUL·서러게이트, 모르는 키는 400이고 아무것도 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    for (const bad of [
      { ...body, name: undefined },
      { ...body, name: '  ' },
      { ...body, name: '😀'.repeat(51) },
      { ...body, schoolName: 'a\u0000' },
      { ...body, cohortName: '\uD800' },
      { ...body, extra: true },
      { ...body, endsOn: '2026-01-01' },
      { ...body, startsOn: '2026-02-30' },
    ]) {
      const response = await api.post('/api/organizations/create', bad, 'u1')
      assert.equal(response.status, 400, JSON.stringify(bad))
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    assert.equal((await testDb.pg.query('SELECT 1 FROM record')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('기수 기간이 오늘(한국 날짜)을 담지 않으면 409 COHORT_NOT_CURRENT다. 한국의 1월 1일 새벽(UTC로는 전날)에 만든 올해 기수는 받는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    for (const period of [
      { startsOn: '2027-01-01', endsOn: '2027-12-31' },
      { startsOn: '2025-01-01', endsOn: '2025-12-31' },
    ]) {
      const response = await api.post('/api/organizations/create', { ...body, ...period }, 'u1')
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'COHORT_NOT_CURRENT' })
    }
    // 2026-01-01 00:30 KST = 2025-12-31 15:30 UTC
    const newYear = appOf(testDb, new Date('2025-12-31T15:30:00Z'))
    const response = await newYear.post('/api/organizations/create', body, 'u1')
    assert.equal(response.status, 201)
    const { council } = (await response.json()) as CreateCouncilResponse
    assert.equal((await newYear.get(`/api/organizations/${council.id}`, 'u1')).status, 200)
  } finally {
    await testDb.close()
  }
})

test('내 학생회 목록: 끝난 소속과 지난 기수는 빠지고 지금 부서 소속이 붙는다. 접근 검사(actorOf)와 어긋나지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const current = await seedCouncil(db, pg, 'a')
    const past = await seedCouncil(db, pg, 'b', { startsOn: '2025-01-01', endsOn: '2025-12-31' })
    const { people, departments, councilId } = current
    const list = (userId: string, now = noon) => myCouncils(db, userId, now)
    assert.deepEqual(await list(people.president.userId), [
      { id: councilId, name: 'a 학생회', councilRank: 'president', departments: [] },
    ])
    assert.deepEqual(await list(people.planningHead.userId), [
      {
        id: councilId,
        name: 'a 학생회',
        councilRank: null,
        departments: [{ id: departments.planning, name: '기획부', rank: 'head' }],
      },
    ])
    assert.deepEqual((await list(people.financeMember.userId))[0]?.departments, [
      { id: departments.finance, name: '재정부', rank: null },
    ])
    // 끝난 소속과 지난 기수의 소속(끝나지 않았어도)은 빠진다.
    assert.deepEqual(await list(people.ended.userId), [])
    assert.deepEqual(await list(past.people.president.userId), [])
    // 같은 사람이 지난 기수 학생회에도 열린 소속과 부서 소속을 가지고 있어도, 지금 학생회와 그 기수의 부서만 나온다.
    await db.transaction(async tx => {
      await createRecord(tx, {
        kind: 'council_membership',
        councilId: past.councilId,
        actor: null,
        values: {
          memberId: people.planningHead.memberId,
          cohortId: past.cohortId,
          startsAt: clockNow,
        },
      })
      await createRecord(tx, {
        kind: 'department_membership',
        councilId: past.councilId,
        actor: null,
        values: {
          memberId: people.planningHead.memberId,
          departmentId: past.departments.finance,
          cohortId: past.cohortId,
          startsAt: clockNow,
        },
      })
    })
    assert.deepEqual(await list(people.planningHead.userId), [
      {
        id: councilId,
        name: 'a 학생회',
        councilRank: null,
        departments: [{ id: departments.planning, name: '기획부', rank: 'head' }],
      },
    ])
    const lastYear = new Date('2025-06-01T03:00:00Z')
    assert.deepEqual(await list(people.planningHead.userId, lastYear), [
      {
        id: past.councilId,
        name: 'b 학생회',
        councilRank: null,
        departments: [{ id: past.departments.finance, name: '재정부', rank: null }],
      },
    ])
    // 끝낸 부서 소속은 빠진다.
    const { rows } = await pg.query<{ id: string }>(
      'SELECT id FROM department_membership WHERE member_id = $1 AND department_id = $2',
      [people.planningHead.memberId, departments.planning],
    )
    await db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: rows[0]!.id,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    assert.deepEqual((await list(people.planningHead.userId))[0]?.departments, [])
    // 목록에 학생회가 있는 것과 그 학생회의 접근 검사가 지금 소속을 찾는 것은 언제나 같다(한국 날짜 경계 포함).
    const moments = [
      lastYear,
      new Date('2025-12-31T14:59:59Z'),
      new Date('2025-12-31T15:00:00Z'),
      noon,
      new Date('2026-12-31T14:59:59Z'),
      new Date('2026-12-31T15:00:00Z'),
      new Date('2027-06-01T03:00:00Z'),
    ]
    for (const seeded of [current, past]) {
      for (const person of Object.values(seeded.people)) {
        for (const now of moments) {
          const listed = (await list(person.userId, now)).some(
            item => item.id === current.councilId || item.id === past.councilId,
          )
          const allowed =
            (await actorOf(db, person.userId, current.councilId, now)) !== null ||
            (await actorOf(db, person.userId, past.councilId, now)) !== null
          assert.equal(listed, allowed, `${person.userId} ${now.toISOString()}`)
        }
      }
    }
  } finally {
    await close()
  }
})

test('한국 날짜 경계의 거절 쪽: 한국의 새해 첫 30분에는 지난해 기수를, 한국의 마지막 날 밤에는 새해 기수를 만들지 못한다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    // 2027-01-01 00:00 KST는 2026-12-31 15:00 UTC, 2025-12-31 23:59:59 KST는 2025-12-31 14:59:59 UTC다.
    for (const at of [
      '2026-12-31T15:00:00Z',
      '2026-12-31T15:30:00Z',
      '2025-12-31T14:59:59Z',
      '2025-12-31T14:30:00Z',
    ]) {
      const response = await appOf(testDb, new Date(at)).post(
        '/api/organizations/create',
        body,
        'u1',
      )
      assert.equal(response.status, 409, at)
      assert.deepEqual(await response.json(), { error: 'COHORT_NOT_CURRENT' }, at)
    }
    assert.equal((await testDb.pg.query('SELECT 1 FROM record')).rows.length, 0)
    // 경계 바로 안쪽은 받는다: 한국의 12월 31일 23:59:59와 1월 1일 00:00:00
    assert.equal(
      (
        await appOf(testDb, new Date('2026-12-31T14:59:59Z')).post(
          '/api/organizations/create',
          body,
          'u1',
        )
      ).status,
      201,
    )
    await addUser(testDb.pg, 'u2')
    assert.equal(
      (
        await appOf(testDb, new Date('2025-12-31T15:00:00Z')).post(
          '/api/organizations/create',
          body,
          'u2',
        )
      ).status,
      201,
    )
  } finally {
    await testDb.close()
  }
})

test('다른 계정에 이어진 운영진이 같은 이메일을 쓰면 만들기는 409 EMAIL_IN_USE이고 아무것도 만들지 않는다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'old', { name: '예전 계정', email: 'park@example.test' })
    const api = appOf(testDb)
    assert.equal((await api.post('/api/organizations/create', body, 'old')).status, 201)
    // 같은 이메일이 다른 Google 계정으로 옮겨 간 경우(드물다)
    await pg.query("UPDATE users SET email = 'park-old@example.test' WHERE id = 'old'")
    await addUser(pg, 'new', { name: '새 계정', email: 'park@example.test' })
    const before = (await pg.query('SELECT 1 FROM record')).rows.length
    const response = await api.post(
      '/api/organizations/create',
      { ...body, name: '경영학부 학생회' },
      'new',
    )
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'EMAIL_IN_USE' })
    assert.equal((await pg.query('SELECT 1 FROM record')).rows.length, before)
    assert.equal((await pg.query('SELECT 1 FROM council')).rows.length, 1)
    assert.equal(
      (await pg.query("SELECT 1 FROM member_login WHERE user_id = 'new'")).rows.length,
      0,
    )
  } finally {
    await testDb.close()
  }
})
