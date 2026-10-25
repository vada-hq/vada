import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import type {
  CreateCouncilResponse,
  InviteCodeResponse,
  InvitePreviewResponse,
  JoinCouncilResponse,
  MyCouncilsResponse,
} from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../test-support/http.js'
import { createInviteRoutes } from './routes.js'
import { joinCouncil, rotateInviteCode } from './service.js'

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
  return caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(db, testSession, () => now),
      invites: createInviteRoutes(db, testSession, () => now),
    }),
  )
}

// 회장(u1)이 학생회를 만들고 초대 코드를 받는다.
async function setup(testDb: TestDb, users = ['u1', 'u2', 'u3']) {
  for (const user of users) await addUser(testDb.pg, user, { name: `이름 ${user}` })
  const api = appOf(testDb)
  const { council } = (await (
    await api.post('/api/organizations/create', body, 'u1')
  ).json()) as CreateCouncilResponse
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, 'u1')
  ).json()) as InviteCodeResponse
  return { api, council, code }
}

// 들어온 사람의 내 학생회 한 줄. 유형과 학교로 같은 이름의 학생회를 가린다(DEC-87).
const memberOf = (id: string) => ({
  id,
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  councilRank: null,
  departments: [],
})

// 초대 확인: 학생회 이름·유형·학교·지금 기수 이름까지다. 운영진 수·이름과 초대한 사람은 없다(DEC-87).
const previewOf = (id: string, joined: boolean, cohortName: string | null = '2026') => ({
  council: {
    id,
    name: '컴퓨터학부 학생회',
    unit: 'department',
    schoolName: '한양대학교 ERICA',
    cohortName,
  },
  joined,
})

// 한 행만 나와야 하는 조회의 그 행
function one<T>(rows: T[]): T {
  assert.equal(rows.length, 1)
  return rows[0]!
}

const membershipsOf = (testDb: TestDb, userId: string) =>
  testDb.pg.query<{
    id: string
    council_rank: string | null
    ends_at: string | null
    starts_at: string
  }>(
    `SELECT cm.id, cm.council_rank, cm.ends_at::text, cm.starts_at::text FROM council_membership cm
   JOIN member_login ml ON ml.member_id = cm.member_id WHERE ml.user_id = $1`,
    [userId],
  )

test('초대 확인은 학생회 이름·유형·학교·기수 이름과 이미 들어왔는지만 보여 주고, 코드는 공백·하이픈·소문자를 정규화한다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
    assert.deepEqual(
      (await (
        await api.get(`/api/invites/${encodeURIComponent(typed)}`, 'u2')
      ).json()) as InvitePreviewResponse,
      previewOf(council.id, false),
    )
    assert.deepEqual(
      (await (await api.get(`/api/invites/${code}`, 'u1')).json()) as InvitePreviewResponse,
      previewOf(council.id, true),
    )
    for (const wrong of ['ZZZZ2222', '%00', 'A'.repeat(17)])
      assert.equal((await api.get(`/api/invites/${wrong}`, 'u2')).status, 404, wrong)
    assert.equal((await api.get(`/api/invites/${code}`)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('초대 확인의 유형·학교·기수 이름은 그 코드의 학생회 것이고, 지금 기수가 없으면 기수 이름은 null이다. 운영진 이름은 싣지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb, ['u1', 'u2', 'u3', 'u4'])
    await api.post('/api/organizations/join', { code }, 'u2')
    // 다른 학생회는 같은 이름으로 만들고 유형·학교·기수 이름만 다르게 둔다. 학생회 거르기가 빠지면 두 확인 중 하나가 틀린다.
    const other = (
      (await (
        await api.post('/api/organizations/create', body, 'u3')
      ).json()) as CreateCouncilResponse
    ).council
    await testDb.pg.query(
      "UPDATE council SET unit = 'university', school_name = '서울대학교' WHERE id = $1",
      [other.id],
    )
    await testDb.pg.query("UPDATE cohort SET name = '제2기' WHERE council_id = $1", [other.id])
    const { code: otherCode } = (await (
      await api.get(`/api/organizations/${other.id}/invite`, 'u3')
    ).json()) as InviteCodeResponse
    const response = await api.get(`/api/invites/${code}`, 'u4')
    const text = await response.text()
    assert.deepEqual(JSON.parse(text), previewOf(council.id, false))
    for (const hidden of ['이름 u1', '이름 u2', 'u1@example.test'])
      assert.ok(!text.includes(hidden), hidden)
    assert.deepEqual(
      (await (await api.get(`/api/invites/${otherCode}`, 'u4')).json()) as InvitePreviewResponse,
      {
        council: {
          id: other.id,
          name: '컴퓨터학부 학생회',
          unit: 'university',
          schoolName: '서울대학교',
          cohortName: '제2기',
        },
        joined: false,
      },
    )
    // 2025-06-01에는 2026 기수가 시작 전이라 지금 기수가 없다. 확인은 되고 기수 이름만 없다.
    const before = appOf(testDb, new Date('2025-06-01T03:00:00Z'))
    assert.deepEqual(
      (await (await before.get(`/api/invites/${code}`, 'u4')).json()) as InvitePreviewResponse,
      previewOf(council.id, false, null),
    )
  } finally {
    await testDb.close()
  }
})

test('초대 코드로 들어오면 지금 기수에 직급과 부서 없이 들어오고, 다시 들어와도 아무것도 바꾸지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    const response = await api.post('/api/organizations/join', { code: code.toLowerCase() }, 'u2')
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()) as JoinCouncilResponse, {
      council: memberOf(council.id),
    })
    const [joined] = (await membershipsOf(testDb, 'u2')).rows
    assert.deepEqual(
      { ...joined, id: undefined, starts_at: undefined },
      { id: undefined, council_rank: null, ends_at: null, starts_at: undefined },
    )
    // 들어온 사람이 자기 소속 기록을 만든 사람이다.
    assert.deepEqual(
      (
        await testDb.pg.query(
          `SELECT r.created_by = ml.member_id AS self FROM record r, member_login ml
      WHERE r.id = $1 AND ml.user_id = 'u2'`,
          [joined!.id],
        )
      ).rows,
      [{ self: true }],
    )
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 1)
    assert.equal(
      (await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [joined!.id]))
        .rows.length,
      1,
    )
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      {
        councils: [memberOf(council.id)],
      },
    )
  } finally {
    await testDb.close()
  }
})

test('두 탭에서 동시에 들어와도 소속과 판은 하나이고 둘 다 200이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, code } = await setup(testDb)
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all([
      api.post('/api/organizations/join', { code }, 'u2'),
      api.post('/api/organizations/join', { code }, 'u2'),
    ])
    assert.deepEqual(
      responses.map(response => response.status),
      [200, 200],
    )
    const memberships = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(memberships.length, 1)
    assert.equal(
      (
        await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [
          memberships[0]!.id,
        ])
      ).rows.length,
      1,
    )
    assert.equal(
      (await testDb.pg.query("SELECT 1 FROM member_login WHERE user_id = 'u2'")).rows.length,
      1,
    )
  } finally {
    await testDb.close()
  }
})

test('내보내졌던 사람이 다시 들어오면 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않고, 끝났던 상태는 판에 남는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id: membershipId, starts_at: firstStart } = one(
      (await membershipsOf(testDb, 'u2')).rows,
    )
    // 부회장이자 재정부원이던 사람을 내보낸다(내보내기 경로는 다음 작업에서 만든다. 여기서는 기록 모듈로 같은 변경을 한다).
    // 거래 안에서는 tx만 쓴다. 거래 밖의 pg.query를 부르면 PGlite가 거래가 끝나기를 기다려 멈춘다.
    const { cohort_id: cohortId, member_id: memberId } = one(
      (
        await testDb.pg.query<{ cohort_id: string; member_id: string }>(
          'SELECT cohort_id, member_id FROM council_membership WHERE id = $1',
          [membershipId],
        )
      ).rows,
    )
    const { id: finance } = one(
      (await testDb.pg.query<{ id: string }>("SELECT id FROM department WHERE role = 'finance'"))
        .rows,
    )
    await testDb.db.transaction(async tx => {
      await updateRecord(tx, {
        kind: 'council_membership',
        id: membershipId,
        actor: null,
        reason: null,
        changes: { councilRank: 'vice_president' },
      })
      const placement = await createRecord(tx, {
        kind: 'department_membership',
        councilId: council.id,
        actor: null,
        values: { memberId, departmentId: finance, cohortId, startsAt: clockNow },
      })
      await updateRecord(tx, {
        kind: 'department_membership',
        id: placement,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      })
      await updateRecord(tx, {
        kind: 'council_membership',
        id: membershipId,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      })
    })
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      { councils: [] },
    )
    assert.deepEqual(
      (await (await api.get(`/api/invites/${code}`, 'u2')).json()) as InvitePreviewResponse,
      previewOf(council.id, false),
    )
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    const [reopened] = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(reopened!.id, membershipId)
    assert.equal(reopened!.council_rank, null)
    assert.equal(reopened!.ends_at, null)
    assert.ok(reopened!.starts_at > firstStart)
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      {
        councils: [memberOf(council.id)],
      },
    )
    const versions = await testDb.pg.query<{ rank: string | null; ended: boolean }>(
      "SELECT data->>'council_rank' AS rank, data->>'ends_at' IS NOT NULL AS ended FROM record_version WHERE record_id = $1 ORDER BY version_no",
      [membershipId],
    )
    assert.deepEqual(versions.rows, [
      { rank: null, ended: false },
      { rank: 'vice_president', ended: false },
      { rank: 'vice_president', ended: true },
      { rank: null, ended: false },
    ])
  } finally {
    await testDb.close()
  }
})

test('초대 코드 보기와 바꾸기는 회장단만 한다. 바꾸면 옛 코드는 막히고 새 코드로 들어온다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb, ['u1', 'u2', 'u3', 'u4'])
    await api.post('/api/organizations/join', { code }, 'u2')
    const other = (
      (await (
        await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u4')
      ).json()) as CreateCouncilResponse
    ).council
    for (const user of ['u2', 'u4']) {
      assert.equal(
        (await api.get(`/api/organizations/${council.id}/invite`, user)).status,
        403,
        user,
      )
      assert.equal(
        (await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)).status,
        403,
        user,
      )
    }
    assert.equal((await api.get(`/api/organizations/${other.id}/invite`, 'u1')).status, 403)
    assert.equal((await api.post(`/api/organizations/${council.id}/invite/rotate`, {})).status, 401)
    const rotated = await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, 'u1')
    assert.equal(rotated.status, 200)
    const { code: next } = (await rotated.json()) as InviteCodeResponse
    assert.match(next, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.notEqual(next, code)
    assert.deepEqual(
      (await (
        await api.get(`/api/organizations/${council.id}/invite`, 'u1')
      ).json()) as InviteCodeResponse,
      { code: next },
    )
    assert.equal((await api.get(`/api/invites/${code}`, 'u3')).status, 404)
    assert.equal((await api.post('/api/organizations/join', { code }, 'u3')).status, 404)
    assert.equal((await api.post('/api/organizations/join', { code: next }, 'u3')).status, 200)
    // 이미 들어온 운영진은 그대로다.
    assert.equal((await api.get(`/api/organizations/${council.id}`, 'u2')).status, 200)
  } finally {
    await testDb.close()
  }
})

test('회장단 둘이 동시에 코드를 바꾸면 둘 다 200이고, 나중 코드 하나만 남아 들어올 수 있다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id } = one((await membershipsOf(testDb, 'u2')).rows)
    await testDb.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'council_membership',
        id,
        actor: null,
        reason: null,
        changes: { councilRank: 'vice_president' },
      }),
    )
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all(
      ['u1', 'u2'].map(user =>
        Promise.resolve(api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)),
      ),
    )
    assert.deepEqual(
      responses.map(response => response.status),
      [200, 200],
    )
    const codes = await Promise.all(
      responses.map(async response => ((await response.json()) as InviteCodeResponse).code),
    )
    const stored = (
      await testDb.pg.query<{ code: string }>(
        'SELECT code FROM invite_code WHERE council_id = $1',
        [council.id],
      )
    ).rows
    assert.equal(stored.length, 1)
    assert.ok(codes.includes(stored[0]!.code))
    for (const used of [code, ...codes.filter(item => item !== stored[0]!.code)])
      assert.equal((await api.get(`/api/invites/${used}`, 'u3')).status, 404)
  } finally {
    await testDb.close()
  }
})

test('지금 기수가 없으면(시작 전) 409 NO_CURRENT_COHORT이고, 들어오기 입력이 틀리면 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { code } = await setup(testDb)
    const lastYear = appOf(testDb, new Date('2025-06-01T03:00:00Z'))
    const late = await lastYear.post('/api/organizations/join', { code }, 'u2')
    assert.equal(late.status, 409)
    assert.deepEqual(await late.json(), { error: 'NO_CURRENT_COHORT' })
    const api = appOf(testDb)
    for (const bad of [
      {},
      { code: '' },
      { code: '   ' },
      { code: 'A'.repeat(17) },
      { code: 'AB\u0000CD' },
      { code: '\uD800' },
      { code, extra: 1 },
    ]) {
      assert.equal(
        (await api.post('/api/organizations/join', bad, 'u2')).status,
        400,
        JSON.stringify(bad),
      )
    }
    assert.equal((await api.post('/api/organizations/join', { code })).status, 401)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('들어오기 응답은 거래 안에서 만든다: 거래 밖에서 읽지 않아도 200이고, 응답은 내 학생회 목록의 한 줄과 같다', async () => {
  const testDb = await createTestDb()
  try {
    const { council, code } = await setup(testDb)
    const response = await appOf(testDb, noon, withoutReadsOutsideTransaction(testDb.db)).post(
      '/api/organizations/join',
      { code },
      'u2',
    )
    assert.equal(response.status, 200)
    const joined = (await response.json()) as JoinCouncilResponse
    assert.deepEqual(joined, {
      council: memberOf(council.id),
    })
    assert.deepEqual(
      (await (await appOf(testDb).get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      { councils: [joined.council] },
    )
    // 이미 들어온 사람이 다시 들어올 때도 같다.
    assert.equal(
      (
        await appOf(testDb, noon, withoutReadsOutsideTransaction(testDb.db)).post(
          '/api/organizations/join',
          { code },
          'u2',
        )
      ).status,
      200,
    )
  } finally {
    await testDb.close()
  }
})

test('내보내졌다가 다시 들어올 때, 끝나지 않고 남은 부서 소속(재정부)도 함께 끝낸다. 판에 남고 재정 권한은 돌아오지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id: membershipId } = one((await membershipsOf(testDb, 'u2')).rows)
    const { cohort_id: cohortId, member_id: memberId } = one(
      (
        await testDb.pg.query<{ cohort_id: string; member_id: string }>(
          'SELECT cohort_id, member_id FROM council_membership WHERE id = $1',
          [membershipId],
        )
      ).rows,
    )
    const { id: finance } = one(
      (await testDb.pg.query<{ id: string }>("SELECT id FROM department WHERE role = 'finance'"))
        .rows,
    )
    // 학생회 소속만 끝나고 재정부 소속은 열린 채로 남은 상태를 손으로 만든다(내보내기는 둘을 함께 끝내지만, 어긋난 기록이 있어도 돌아오지 않아야 한다).
    const placement = await testDb.db.transaction(async tx => {
      const created = await createRecord(tx, {
        kind: 'department_membership',
        councilId: council.id,
        actor: null,
        values: {
          memberId,
          departmentId: finance,
          cohortId,
          departmentRank: 'head',
          startsAt: clockNow,
        },
      })
      await updateRecord(tx, {
        kind: 'council_membership',
        id: membershipId,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      })
      return created
    })
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    const [ended] = (
      await testDb.pg.query<{ ends_at: string | null; department_rank: string | null }>(
        'SELECT ends_at::text, department_rank FROM department_membership WHERE id = $1',
        [placement],
      )
    ).rows
    assert.notEqual(ended!.ends_at, null)
    // 끝난 상태가 새 판으로 남는다. 직급은 그대로 두고 끝 시각만 적는다.
    const versions = await testDb.pg.query<{ ended: boolean; rank: string | null }>(
      "SELECT data->>'ends_at' IS NOT NULL AS ended, data->>'department_rank' AS rank FROM record_version WHERE record_id = $1 ORDER BY version_no",
      [placement],
    )
    assert.deepEqual(versions.rows, [
      { ended: false, rank: 'head' },
      { ended: true, rank: 'head' },
    ])
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'u2')).json()) as MyCouncilsResponse,
      {
        councils: [memberOf(council.id)],
      },
    )
    // 학생회 소속은 다시 열렸다.
    assert.equal(one((await membershipsOf(testDb, 'u2')).rows).ends_at, null)
  } finally {
    await testDb.close()
  }
})

test('들어오기의 한국 날짜 경계: 한국의 1월 1일 0시에 시작하는 기수는 그 순간부터 들어올 수 있고, 끝 날짜가 지나도 들어올 수 있다(DEC-57)', async () => {
  const testDb = await createTestDb()
  try {
    const { code } = await setup(testDb, ['u1', 'u2', 'u3', 'u4', 'u5'])
    const joinAt = (at: string, user: string) =>
      appOf(testDb, new Date(at)).post('/api/organizations/join', { code }, user)
    // 기수는 2026-01-01 ~ 2026-12-31이다. 2026-01-01 00:00 KST = 2025-12-31 15:00 UTC.
    assert.equal((await joinAt('2025-12-31T15:00:00Z', 'u2')).status, 200)
    assert.equal((await joinAt('2026-12-31T14:59:59Z', 'u3')).status, 200)
    assert.equal((await joinAt('2026-12-31T15:00:00Z', 'u5')).status, 200)
    const response = await joinAt('2025-12-31T14:59:59Z', 'u4')
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'NO_CURRENT_COHORT' })
    assert.equal((await membershipsOf(testDb, 'u4')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('들어오기는 늦게 시작한 기수로 들어간다. 다음 기수가 시작하기 전에는 앞 기수로 들어간다', async () => {
  const testDb = await createTestDb()
  try {
    const { council, code } = await setup(testDb, ['u1', 'u2', 'u3'])
    const nextCohort = await testDb.db.transaction(tx =>
      createRecord(tx, {
        kind: 'cohort',
        councilId: council.id,
        actor: null,
        values: { name: '2027', startsOn: '2027-03-01', endsOn: '2028-02-29' },
      }),
    )
    const cohortOf = async (user: string) =>
      (
        await testDb.pg.query<{ cohort_id: string }>(
          `SELECT cm.cohort_id FROM council_membership cm
           JOIN member_login ml ON ml.member_id = cm.member_id WHERE ml.user_id = $1`,
          [user],
        )
      ).rows.map(row => row.cohort_id)
    const joinAt = (at: string, user: string) =>
      appOf(testDb, new Date(at)).post('/api/organizations/join', { code }, user)
    // 한국 2027-03-01 00:00 = 2027-02-28 15:00 UTC
    assert.equal((await joinAt('2027-02-28T14:59:59Z', 'u2')).status, 200)
    assert.equal((await joinAt('2027-02-28T15:00:00Z', 'u3')).status, 200)
    const [before] = await cohortOf('u2')
    assert.notEqual(before, nextCohort)
    assert.deepEqual(await cohortOf('u3'), [nextCohort])
    // 들어온 뒤 내 학생회 목록에 같은 학생회가 보인다.
    const listed = (await (
      await appOf(testDb, new Date('2027-02-28T15:00:00Z')).get('/api/me/councils', 'u3')
    ).json()) as MyCouncilsResponse
    assert.deepEqual(
      listed.councils.map(item => item.id),
      [council.id],
    )
  } finally {
    await testDb.close()
  }
})

test('다른 학생회에 더 늦게 시작한 기수가 있어도 초대로 들어오면 이 학생회의 지금 기수에 소속이 생긴다', async () => {
  const testDb = await createTestDb()
  try {
    const { council, code } = await setup(testDb, ['u1', 'u2'])
    const own = (
      await testDb.pg.query<{ id: string }>('SELECT id FROM cohort WHERE council_id = $1', [
        council.id,
      ])
    ).rows
    assert.equal(own.length, 1)
    // 다른 학생회의 기수는 이 학생회 기수(2026-01-01 시작)보다 늦게, 오늘(2026-10-19) 전에 시작했다.
    await testDb.db.transaction(async tx => {
      const otherId = await createRecord(tx, {
        kind: 'council',
        councilId: null,
        actor: null,
        values: { name: '다른 학생회', unit: 'department', schoolName: '다른 학교' },
      })
      await createRecord(tx, {
        kind: 'cohort',
        councilId: otherId,
        actor: null,
        values: { name: '2026-2', startsOn: '2026-06-01', endsOn: '2027-05-31' },
      })
    })
    assert.equal((await appOf(testDb).post('/api/organizations/join', { code }, 'u2')).status, 200)
    const joined = await testDb.pg.query<{ cohort_id: string }>(
      `SELECT cm.cohort_id FROM council_membership cm
       JOIN member_login ml ON ml.member_id = cm.member_id WHERE ml.user_id = 'u2'`,
    )
    assert.deepEqual(
      joined.rows.map(row => row.cohort_id),
      [own[0]!.id],
    )
  } finally {
    await testDb.close()
  }
})

test('들어오기는 학생회 행을 FOR NO KEY UPDATE로 잠근 뒤 코드를 다시 확인하고 소속을 만든다', async () => {
  const testDb = await createTestDb()
  try {
    const { code } = await setup(testDb)
    const queries: string[] = []
    const db = drizzle(testDb.pg, {
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    await db.transaction(tx => joinCouncil(tx, 'u2', code, noon))
    const lock = queries.findIndex(
      query => query.includes('from "council"') && query.endsWith(' for no key update'),
    )
    assert.ok(lock >= 0, JSON.stringify(queries))
    // 잠근 문장 뒤에 코드를 다시 확인하고, 기수와 소속을 읽고 쓴다.
    assert.ok(
      queries.findIndex((query, index) => index > lock && query.includes('"invite_code"')) > lock,
    )
    assert.ok(
      queries.findIndex(
        (query, index) => index > lock && query.includes('insert into "council_membership"'),
      ) > lock,
    )
    assert.equal(
      queries.findIndex(query => query.includes('"cohort"') && query.includes('"starts_on"')) >
        lock,
      true,
    )
  } finally {
    await testDb.close()
  }
})

test('rotateInviteCode는 이 학생회의 코드 한 줄을 새 코드로 바꾸고 바꾼 사람을 남긴다', async () => {
  const testDb = await createTestDb()
  try {
    const { council, code } = await setup(testDb)
    const next = await inCouncilChange(
      testDb.db,
      { userId: 'u1', councilId: council.id, action: 'invite.manage', now: noon },
      (tx, actor) => rotateInviteCode(tx, actor),
    )
    assert.match(next, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.notEqual(next, code)
    const rows = (
      await testDb.pg.query<{ code: string; by_user: string }>(
        `SELECT ic.code, ml.user_id AS by_user FROM invite_code ic
         JOIN member_login ml ON ml.member_id = ic.created_by WHERE ic.council_id = $1`,
        [council.id],
      )
    ).rows
    assert.deepEqual(rows, [{ code: next, by_user: 'u1' }])
  } finally {
    await testDb.close()
  }
})
