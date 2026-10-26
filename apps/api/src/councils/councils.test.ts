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
  year: 2026,
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
      {
        id: undefined,
        name: '컴퓨터학부 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        councilRank: 'president',
        departments: [],
      },
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
      ['member', 'council', 'cohort', 'council_membership', 'department', 'chat_room', 'chat_room'],
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
      [{ n: 7 }],
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
      'schoolName',
      'unit',
    ])
    assert.match(
      created.council.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    assert.deepEqual(
      { ...created.council, id: undefined },
      {
        id: undefined,
        name: '컴퓨터학부 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        councilRank: 'president',
        departments: [],
      },
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

test('내 학생회 목록과 학생회 하나 보기: 만든 사람은 회장이고 조직 칸 권한을 가진다(방·요청한 사람·행사 책임자·재정 칸은 맥락이 있어야 해 뺀다)', async () => {
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
    // chat.use는 방 참여자만, purchase.cancel은 요청한 사람만, 결재와 재정 관리와 납부자 명단 올리기는 재정부만이라 회장의 목록에 없다.
    const notListed = [
      'chat.use',
      'purchase.cancel',
      'purchase.shipment',
      'purchase.approve',
      'finance.manage',
      'fee_payment.manage',
    ]
    assert.deepEqual(
      view.permissions,
      ACTIONS.filter(action => !notListed.includes(action)),
    )
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

test('학생회 만들기 입력: 빠진 값, 빈 값, 상한+1, NUL·서러게이트, 모르는 키, 옛 기수 칸, 선택지 밖의 운영 연도는 400이고 아무것도 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    for (const bad of [
      { ...body, name: undefined },
      { ...body, year: undefined },
      { ...body, name: '  ' },
      { ...body, name: '😀'.repeat(51) },
      { ...body, schoolName: 'a\u0000' },
      { ...body, memberName: '\uD800' },
      { ...body, extra: true },
      { ...body, cohortName: '2026' },
      { ...body, startsOn: '2026-01-01' },
      { ...body, endsOn: '2026-12-31' },
      { ...body, year: '2026' },
      // 2026-10-19의 선택지는 2025, 2026, 2027이다.
      { ...body, year: 2024 },
      { ...body, year: 2028 },
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

// 그 사람이 만든 학생회의 기수 이름과 기간
async function cohortOf(testDb: TestDb, councilId: string) {
  const { rows } = await testDb.pg.query(
    'SELECT name, starts_on::text, ends_on::text FROM cohort WHERE council_id = $1',
    [councilId],
  )
  return rows
}

test('운영 연도로 기수를 채운다: 작년·올해는 1월 1일~12월 31일, 내년은 오늘~12월 31일이고, 만든 사람이 곧바로 연다(작년도)', async () => {
  const testDb = await createTestDb()
  try {
    const api = appOf(testDb)
    for (const [user, year, startsOn] of [
      ['u1', 2025, '2025-01-01'],
      ['u2', 2026, '2026-01-01'],
      ['u3', 2027, '2026-10-19'],
    ] as const) {
      await addUser(testDb.pg, user)
      const response = await api.post('/api/organizations/create', { ...body, year }, user)
      assert.equal(response.status, 201, String(year))
      const { council } = (await response.json()) as CreateCouncilResponse
      assert.deepEqual(await cohortOf(testDb, council.id), [
        { name: String(year), starts_on: startsOn, ends_on: `${year}-12-31` },
      ])
      assert.equal((await api.get(`/api/organizations/${council.id}`, user)).status, 200)
      assert.deepEqual(
        ((await (await api.get('/api/me/councils', user)).json()) as MyCouncilsResponse).councils
          .length,
        1,
      )
    }
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
    // 끝 날짜가 지났어도 다음 기수가 시작하기 전에는 그 기수가 지금 기수다(DEC-57).
    assert.deepEqual(await list(past.people.president.userId), [
      {
        id: past.councilId,
        name: 'b 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        councilRank: 'president',
        departments: [],
      },
    ])
    // b 학생회에 다음 기수(2026-01-01 시작)가 생기면 2025 기수는 지난 기수다.
    await db.transaction(tx =>
      createRecord(tx, {
        kind: 'cohort',
        councilId: past.councilId,
        actor: null,
        values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      }),
    )
    assert.deepEqual(await list(people.president.userId), [
      {
        id: councilId,
        name: 'a 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        councilRank: 'president',
        departments: [],
      },
    ])
    assert.deepEqual(await list(people.planningHead.userId), [
      {
        id: councilId,
        name: 'a 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
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
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        councilRank: null,
        departments: [{ id: departments.planning, name: '기획부', rank: 'head' }],
      },
    ])
    const lastYear = new Date('2025-06-01T03:00:00Z')
    assert.deepEqual(await list(people.planningHead.userId, lastYear), [
      {
        id: past.councilId,
        name: 'b 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
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

test('운영 연도의 한국 날짜 경계: 선택지와 내년의 시작일은 한국 날짜로 바뀐다(해가 바뀐 뒤 보낸 작년의 작년은 400)', async () => {
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user)
    const create = (at: string, year: number, user: string) =>
      appOf(testDb, new Date(at)).post('/api/organizations/create', { ...body, year }, user)
    // 2025-12-31 23:59:59 KST(14:59:59 UTC)에는 2027이 선택지 밖이고, 2026은 내년이라 그날 시작한다.
    const late = '2025-12-31T14:59:59Z'
    const outside = await create(late, 2027, 'u1')
    assert.equal(outside.status, 400)
    assert.deepEqual(await outside.json(), { error: 'INVALID_INPUT' })
    assert.equal((await testDb.pg.query('SELECT 1 FROM record')).rows.length, 0)
    const nextYear = await create(late, 2026, 'u1')
    assert.equal(nextYear.status, 201)
    const { council: made } = (await nextYear.json()) as CreateCouncilResponse
    assert.deepEqual(await cohortOf(testDb, made.id), [
      { name: '2026', starts_on: '2025-12-31', ends_on: '2026-12-31' },
    ])
    // 2026-01-01 00:00:00 KST(15:00:00 UTC)부터는 2024가 선택지 밖이고 2025는 작년이다.
    const newYear = '2025-12-31T15:00:00Z'
    assert.equal((await create(newYear, 2024, 'u2')).status, 400)
    const lastYear = await create(newYear, 2025, 'u2')
    assert.equal(lastYear.status, 201)
    const { council } = (await lastYear.json()) as CreateCouncilResponse
    assert.deepEqual(await cohortOf(testDb, council.id), [
      { name: '2025', starts_on: '2025-01-01', ends_on: '2025-12-31' },
    ])
    assert.equal(
      (await appOf(testDb, new Date(newYear)).get(`/api/organizations/${council.id}`, 'u2')).status,
      200,
    )
    assert.equal((await create(newYear, 2027, 'u3')).status, 201)
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
