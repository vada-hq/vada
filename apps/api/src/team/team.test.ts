import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { PERMISSIONS, type Rule } from '../access/permissions.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

const noon = new Date('2026-10-19T03:00:00Z')
const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}

function appOf(testDb: TestDb, db: TestDb['db'] = testDb.db) {
  const clock = () => noon
  return caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(db, testSession, clock),
      invites: createInviteRoutes(db, testSession, clock),
      team: createTeamRoutes(db, testSession, clock),
    }),
  )
}

// 회장 u1이 학생회를 만들고 u2·u3·u4가 초대로 들어온다. u5는 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2', 'u3', 'u4', 'u5'])
    await addUser(testDb.pg, user, { name: `이름 ${user}`, email: `${user}@example.test` })
  const api = appOf(testDb)
  const { council } = (await (
    await api.post('/api/organizations/create', body, 'u1')
  ).json()) as CreateCouncilResponse
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, 'u1')
  ).json()) as InviteCodeResponse
  for (const user of ['u2', 'u3', 'u4']) await api.post('/api/organizations/join', { code }, user)
  const { council: other } = (await (
    await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u5')
  ).json()) as CreateCouncilResponse
  const team = (await (
    await api.get(`/api/organizations/${council.id}/members`, 'u1')
  ).json()) as TeamResponse
  const otherTeam = (await (
    await api.get(`/api/organizations/${other.id}/members`, 'u5')
  ).json()) as TeamResponse
  const id = (user: string) => team.members.find(item => item.name === `이름 ${user}`)!.id
  const base = `/api/organizations/${council.id}`
  return {
    api,
    base,
    council,
    other,
    finance: team.departments[0]!.id,
    otherFinance: otherTeam.departments[0]!.id,
    otherPresident: otherTeam.members[0]!.id,
    member: { u1: id('u1'), u2: id('u2'), u3: id('u3'), u4: id('u4') },
  }
}

// 그 학생회의 끝나지 않은 회장 소속
const presidentsOf = async (testDb: TestDb, councilId: string) =>
  (
    await testDb.pg.query<{ member_id: string }>(
      `SELECT cm.member_id FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
   WHERE co.council_id = $1 AND cm.council_rank = 'president' AND cm.ends_at IS NULL`,
      [councilId],
    )
  ).rows.map(row => row.member_id)

const versionsOf = async (testDb: TestDb, recordId: string) =>
  (
    await testDb.pg.query<{ version_no: number }>(
      'SELECT version_no FROM record_version WHERE record_id = $1',
      [recordId],
    )
  ).rows.length

// 한 사람(x)이 두 학생회 A와 B에 모두 들어 있다. 각 학생회의 회장이 x를 자기 재정부에 부장으로 넣는다. B에서는 부회장 직급도 준다.
async function twoCouncils(testDb: TestDb) {
  for (const user of ['a', 'b', 'x'])
    await addUser(testDb.pg, user, { name: `이름 ${user}`, email: `${user}@example.test` })
  const api = appOf(testDb)
  const make = async (user: string, name: string) => {
    const { council } = (await (
      await api.post('/api/organizations/create', { ...body, name }, user)
    ).json()) as CreateCouncilResponse
    const { code } = (await (
      await api.get(`/api/organizations/${council.id}/invite`, user)
    ).json()) as InviteCodeResponse
    assert.equal((await api.post('/api/organizations/join', { code }, 'x')).status, 200)
    const base = `/api/organizations/${council.id}`
    const team = (await (await api.get(`${base}/members`, user)).json()) as TeamResponse
    return {
      base,
      finance: team.departments[0]!.id,
      xId: team.members.find(item => item.name === '이름 x')!.id,
      president: user,
    }
  }
  const a = await make('a', 'A 학생회')
  const b = await make('b', 'B 학생회')
  for (const council of [a, b]) {
    assert.equal(
      (
        await api.post(
          `${council.base}/members/${council.xId}/departments`,
          { departmentId: council.finance, rank: 'head' },
          council.president,
        )
      ).status,
      200,
    )
  }
  assert.equal(
    (await api.post(`${b.base}/members/${b.xId}/rank`, { rank: 'vice_president' }, 'b')).status,
    200,
  )
  return { api, a, b }
}

test('운영진 목록: 모든 운영진이 들어온 순서대로 이름, 직급, 부서, 들어온 시각을 보고 이메일은 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const response = await api.get(`${base}/members`, 'u3')
    assert.equal(response.status, 200)
    const team = (await response.json()) as TeamResponse
    assert.deepEqual(
      team.members.map(item => [item.id, item.name, item.councilRank, item.departments]),
      [
        [member.u1, '이름 u1', 'president', []],
        [member.u2, '이름 u2', null, []],
        [member.u3, '이름 u3', null, []],
        [member.u4, '이름 u4', null, []],
      ],
    )
    assert.ok(team.members.every(item => !Number.isNaN(Date.parse(item.joinedAt))))
    assert.deepEqual(team.departments, [
      { id: finance, name: '재정부', role: 'finance', memberCount: 0 },
    ])
    assert.ok(!JSON.stringify(team).includes('@'))
    assert.deepEqual(Object.keys(team.members[0]!).sort(), [
      'councilRank',
      'departments',
      'id',
      'joinedAt',
      'name',
    ])
    assert.equal((await api.get(`${base}/members`, 'u5')).status, 403)
    assert.equal((await api.get(`${base}/members`)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('부서 배정과 부서 직급: 처음이면 만들고, 직급만 바꾸고, 같으면 그대로, 빼면 끝내고, 다시 넣으면 같은 소속을 연다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const assign = (rank: string | null) =>
      api.post(`${base}/members/${member.u2}/departments`, { departmentId: finance, rank }, 'u1')
    let team = (await (await assign('head')).json()) as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [
      { id: finance, rank: 'head' },
    ])
    assert.equal(team.departments[0]!.memberCount, 1)
    const [{ id: placement }] = (
      await testDb.pg.query<{ id: string }>('SELECT id FROM department_membership')
    ).rows as [{ id: string }]
    team = (await (await assign('vice_head')).json()) as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [
      { id: finance, rank: 'vice_head' },
    ])
    assert.equal((await assign('vice_head')).status, 200)
    assert.equal(await versionsOf(testDb, placement), 2)
    team = (await (
      await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1')
    ).json()) as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [])
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1'))
        .status,
      404,
    )
    team = (await (await assign(null)).json()) as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [
      { id: finance, rank: null },
    ])
    assert.equal((await testDb.pg.query('SELECT id FROM department_membership')).rows.length, 1)
    assert.equal(await versionsOf(testDb, placement), 4)
  } finally {
    await testDb.close()
  }
})

test('편성은 회장단만 한다. 다른 학생회의 부서나 운영진 번호는 404, 형식이 틀린 본문은 400이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance, otherFinance, otherPresident } = await setup(testDb)
    const attempts = [
      [`${base}/members/${member.u2}/departments`, { departmentId: finance, rank: null }],
      [`${base}/members/${member.u2}/departments/${finance}/remove`, {}],
      [`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }],
      [`${base}/president/transfer`, { memberId: member.u2 }],
      [`${base}/members/${member.u2}/remove`, {}],
    ] as const
    for (const [path, payload] of attempts) {
      assert.equal((await api.post(path, payload, 'u3')).status, 403, path)
      assert.equal((await api.post(path, payload, 'u5')).status, 403, path)
      assert.equal((await api.post(path, payload)).status, 401, path)
    }
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u2}/departments`,
          { departmentId: otherFinance, rank: null },
          'u1',
        )
      ).status,
      404,
    )
    assert.equal(
      (
        await api.post(
          `${base}/members/${otherPresident}/departments`,
          { departmentId: finance, rank: null },
          'u1',
        )
      ).status,
      404,
    )
    assert.equal((await api.post(`${base}/members/${otherPresident}/remove`, {}, 'u1')).status, 404)
    assert.equal(
      (await api.post(`${base}/president/transfer`, { memberId: otherPresident }, 'u1')).status,
      404,
    )
    assert.equal((await api.post(`${base}/members/not-a-uuid/remove`, {}, 'u1')).status, 404)
    for (const payload of [
      {},
      { departmentId: 'probe', rank: null },
      { departmentId: finance, rank: 'president' },
      { departmentId: finance, rank: null, extra: 1 },
    ]) {
      assert.equal(
        (await api.post(`${base}/members/${member.u2}/departments`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
    for (const payload of [{ rank: 'president' }, {}, { rank: null, extra: 1 }]) {
      assert.equal(
        (await api.post(`${base}/members/${member.u2}/rank`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/remove`, { reason: 'x' }, 'u1')).status,
      400,
    )
  } finally {
    await testDb.close()
  }
})

test('부회장을 주면 회장단 권한이 생기고, 거두면 다음 요청부터 막힌다. 회장의 직급은 이 경로로 바꿀 수 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const team = (await (
      await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    ).json()) as TeamResponse
    assert.equal(team.members.find(item => item.id === member.u2)!.councilRank, 'vice_president')
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u3}/departments`,
          { departmentId: finance, rank: 'head' },
          'u2',
        )
      ).status,
      200,
    )
    const president = await api.post(`${base}/members/${member.u1}/rank`, { rank: null }, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_REQUIRED' })
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/rank`, { rank: null }, 'u1')).status,
      200,
    )
    assert.equal(
      (await api.post(`${base}/members/${member.u3}/departments/${finance}/remove`, {}, 'u2'))
        .status,
      403,
    )
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기는 회장만 한다. 넘긴 사람은 직급 없음이 되고, 자기에게 넘기면 409다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    assert.equal(
      (await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u2')).status,
      403,
    )
    const self = await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'ALREADY_PRESIDENT' })
    const team = (await (
      await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u1')
    ).json()) as TeamResponse
    assert.deepEqual(
      team.members.map(item => item.councilRank),
      [null, 'vice_president', 'president', null],
    )
    assert.equal(
      (await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')).status,
      403,
    )
    assert.deepEqual(await presidentsOf(testDb, council.id), [member.u3])
  } finally {
    await testDb.close()
  }
})

test('내보내기: 회장은 409 PRESIDENT_CANNOT_LEAVE, 스스로는 409 CANNOT_REMOVE_SELF. 내보내면 부서 소속도 끝나고 다음 요청부터 403이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    await api.post(
      `${base}/members/${member.u4}/departments`,
      { departmentId: finance, rank: 'head' },
      'u1',
    )
    const president = await api.post(`${base}/members/${member.u1}/remove`, {}, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_CANNOT_LEAVE' })
    const self = await api.post(`${base}/members/${member.u2}/remove`, {}, 'u2')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'CANNOT_REMOVE_SELF' })
    assert.equal((await api.get(base, 'u4')).status, 200)
    const team = (await (
      await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')
    ).json()) as TeamResponse
    assert.ok(!team.members.some(item => item.id === member.u4))
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal(
      (await testDb.pg.query('SELECT 1 FROM department_membership WHERE ends_at IS NULL')).rows
        .length,
      0,
    )
    assert.equal((await api.get(base, 'u4')).status, 403)
    assert.equal((await api.get(`${base}/members`, 'u4')).status, 403)
    assert.equal((await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')).status, 404)
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기와 내보내기가 겹쳐도 회장은 늘 한 명이고, 내보낸 사람은 회장이 되지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const [transfer, removal] = await Promise.all([
      api.post(`${base}/president/transfer`, { memberId: member.u4 }, 'u1'),
      api.post(`${base}/members/${member.u4}/remove`, {}, 'u2'),
    ])
    assert.ok(
      [
        [200, 409],
        [404, 200],
      ].some(([a, b]) => transfer.status === a && removal.status === b),
      `${transfer.status} ${removal.status}`,
    )
    const presidents = await presidentsOf(testDb, council.id)
    assert.equal(presidents.length, 1)
    const removed =
      (
        await testDb.pg.query(
          'SELECT 1 FROM council_membership WHERE member_id = $1 AND ends_at IS NOT NULL',
          [member.u4],
        )
      ).rows.length === 1
    assert.equal(presidents[0], removed ? member.u1 : member.u4)
  } finally {
    await testDb.close()
  }
})

test('두 학생회에 든 사람: A에서 내보내도 B의 부서 소속과 직급은 그대로이고, A의 목록에는 B의 부서와 직급이 보이지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, a, b } = await twoCouncils(testDb)
    const xIn = async (council: typeof a) =>
      (
        (await (await api.get(`${council.base}/members`, council.president)).json()) as TeamResponse
      ).members.find(item => item.id === council.xId)!
    // A의 목록: A의 재정부 부장이고 직급 없음. B의 부서와 부회장 직급은 보이지 않는다.
    const inA = await xIn(a)
    assert.deepEqual(
      { ...inA, joinedAt: undefined },
      {
        id: a.xId,
        name: '이름 x',
        councilRank: null,
        joinedAt: undefined,
        departments: [{ id: a.finance, rank: 'head' }],
      },
    )
    const inB = await xIn(b)
    assert.deepEqual(inB.departments, [{ id: b.finance, rank: 'head' }])
    assert.equal(inB.councilRank, 'vice_president')
    // A에서 내보낸다. B의 소속은 그대로다.
    assert.equal((await api.post(`${a.base}/members/${a.xId}/remove`, {}, 'a')).status, 200)
    const placements = (
      await testDb.pg.query<{ department_id: string; ended: boolean }>(
        'SELECT department_id, ends_at IS NOT NULL AS ended FROM department_membership WHERE member_id = $1',
        [a.xId],
      )
    ).rows
    assert.equal(placements.length, 2)
    assert.equal(placements.find(row => row.department_id === a.finance)?.ended, true)
    assert.equal(placements.find(row => row.department_id === b.finance)?.ended, false)
    const afterB = await xIn(b)
    assert.deepEqual(afterB.departments, [{ id: b.finance, rank: 'head' }])
    assert.equal(afterB.councilRank, 'vice_president')
    assert.equal((await api.get(b.base, 'x')).status, 200)
    assert.equal((await api.get(a.base, 'x')).status, 403)
  } finally {
    await testDb.close()
  }
})

test('이미 부서에서 뺀 소속은 학생회에서 내보낼 때 다시 끝내지 않는다. 같은 직급으로 바꾸는 요청도 판을 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u2}/departments`,
          { departmentId: finance, rank: 'head' },
          'u1',
        )
      ).status,
      200,
    )
    const [{ id: placement }] = (
      await testDb.pg.query<{ id: string }>('SELECT id FROM department_membership')
    ).rows as [{ id: string }]
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1'))
        .status,
      200,
    )
    const endedAt = async () =>
      (
        await testDb.pg.query<{ ends_at: string }>(
          'SELECT ends_at::text FROM department_membership WHERE id = $1',
          [placement],
        )
      ).rows[0]!.ends_at
    const firstEnd = await endedAt()
    assert.equal(await versionsOf(testDb, placement), 2)
    assert.equal((await api.post(`${base}/members/${member.u2}/remove`, {}, 'u1')).status, 200)
    assert.equal(await endedAt(), firstEnd)
    assert.equal(await versionsOf(testDb, placement), 2)
    // 같은 직급으로 바꾸는 요청: 직급 없는 사람의 직급을 비우거나 부회장에게 부회장을 다시 줘도 판은 늘지 않는다.
    const [{ id: membership }] = (
      await testDb.pg.query<{ id: string }>(
        'SELECT id FROM council_membership WHERE member_id = $1',
        [member.u3],
      )
    ).rows as [{ id: string }]
    assert.equal(await versionsOf(testDb, membership), 1)
    assert.equal(
      (await api.post(`${base}/members/${member.u3}/rank`, { rank: null }, 'u1')).status,
      200,
    )
    assert.equal(await versionsOf(testDb, membership), 1)
    assert.equal(
      (await api.post(`${base}/members/${member.u3}/rank`, { rank: 'vice_president' }, 'u1'))
        .status,
      200,
    )
    assert.equal(await versionsOf(testDb, membership), 2)
    assert.equal(
      (await api.post(`${base}/members/${member.u3}/rank`, { rank: 'vice_president' }, 'u1'))
        .status,
      200,
    )
    assert.equal(await versionsOf(testDb, membership), 2)
  } finally {
    await testDb.close()
  }
})

// 지금 권한표는 부서에서 빼기·내보내기(member.manage)와 직급 칸(rank.manage)이 같은 사람(회장단)이라 둘의 차이가 드러나지 않는다.
// 직급이 붙은 소속을 끝내는 일은 직급을 거두는 일이기도 하므로 두 칸을 함께 본다. 시험에서만 직급 칸을 회장으로 좁혀 그 차이를 본다.
async function withRankManageForPresidentOnly(run: () => Promise<void>) {
  const table = PERMISSIONS as { -readonly [A in keyof typeof PERMISSIONS]: Rule }
  const original = table['rank.manage']
  table['rank.manage'] = { who: ['president'] }
  try {
    await run()
  } finally {
    table['rank.manage'] = original
  }
}

test('직급이 붙은 소속을 끝내려면 직급 칸도 필요하다: 부서에서 빼기와 내보내기는 직급이 있을 때만 직급 칸을 함께 본다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    // 부회장 u2, 재정부 부장 u3, 재정부원(직급 없음) u4. 직급 칸을 좁히기 전에 만들어 둔다.
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1'))
        .status,
      200,
    )
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u3}/departments`,
          { departmentId: finance, rank: 'head' },
          'u1',
        )
      ).status,
      200,
    )
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u4}/departments`,
          { departmentId: finance, rank: null },
          'u1',
        )
      ).status,
      200,
    )
    await withRankManageForPresidentOnly(async () => {
      // 부회장은 member.manage는 있지만 rank.manage는 없다.
      const asVice = (path: string) => api.post(path, {}, 'u2')
      assert.equal(
        (await asVice(`${base}/members/${member.u3}/departments/${finance}/remove`)).status,
        403,
      )
      assert.equal((await asVice(`${base}/members/${member.u3}/remove`)).status, 403)
      // 직급이 없는 소속은 member.manage만으로 끝낼 수 있다.
      assert.equal(
        (await asVice(`${base}/members/${member.u4}/departments/${finance}/remove`)).status,
        200,
      )
      // 아무것도 바뀌지 않았다: u3의 부서 직급과 소속
      assert.deepEqual(
        (
          await testDb.pg.query(
            'SELECT department_rank, ends_at IS NULL AS open FROM department_membership WHERE member_id = $1',
            [member.u3],
          )
        ).rows,
        [{ department_rank: 'head', open: true }],
      )
      assert.equal(
        (
          await testDb.pg.query(
            'SELECT 1 FROM council_membership WHERE member_id = $1 AND ends_at IS NOT NULL',
            [member.u3],
          )
        ).rows.length,
        0,
      )
      // 회장은 둘 다 있다.
      assert.equal(
        (await api.post(`${base}/members/${member.u3}/departments/${finance}/remove`, {}, 'u1'))
          .status,
        200,
      )
    })
    // 부회장 직급이 붙은 소속은 부회장이 내보내지 못하고, 직급도 부서도 없는 소속은 내보낸다.
    assert.equal(
      (
        await api.post(
          `${base}/members/${member.u3}/departments`,
          { departmentId: finance, rank: null },
          'u1',
        )
      ).status,
      200,
    )
    assert.equal(
      (await api.post(`${base}/members/${member.u4}/rank`, { rank: 'vice_president' }, 'u1'))
        .status,
      200,
    )
    await withRankManageForPresidentOnly(async () => {
      assert.equal((await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')).status, 403)
      assert.equal((await api.post(`${base}/members/${member.u3}/remove`, {}, 'u2')).status, 200)
      assert.equal((await api.post(`${base}/members/${member.u4}/remove`, {}, 'u1')).status, 200)
    })
  } finally {
    await testDb.close()
  }
})

test('운영진 목록은 한 시점의 모습이다: 읽기 전용 REPEATABLE READ 거래 하나에서 권한 확인과 세 조회를 하고, 바꾸기는 기본 격리 수준을 쓴다', async () => {
  const testDb = await createTestDb()
  try {
    const { base } = await setup(testDb)
    const queries: string[] = []
    const logged = drizzle(testDb.pg, {
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const api = appOf(testDb, logged)
    assert.equal((await api.get(`${base}/members`, 'u1')).status, 200)
    assert.equal(queries[0], 'set transaction isolation level repeatable read read only')
    const reads = queries.slice(1)
    // 지금 소속 2(학생회, 부서), 운영진, 부서 소속, 부서
    assert.equal(reads.length, 5, JSON.stringify(reads))
    assert.ok(
      reads.every(query => query.startsWith('select ')),
      JSON.stringify(reads),
    )
    assert.match(reads[0]!, /"member_login"/)
    // 거절도 같은 거래 안에서 나온다.
    queries.length = 0
    assert.equal((await api.get(`${base}/members`, 'u5')).status, 403)
    assert.equal(queries[0], 'set transaction isolation level repeatable read read only')
    // 바꾸기는 격리 수준을 올리지 않는다(잠근 뒤 다시 보기는 READ COMMITTED에 기댄다).
    queries.length = 0
    assert.equal(
      (await api.post(`${base}/members/${'01900000-0000-7000-8000-000000000000'}/remove`, {}, 'u1'))
        .status,
      404,
    )
    assert.ok(queries.length > 0)
    assert.ok(!queries.some(query => query.startsWith('set transaction')), JSON.stringify(queries))
  } finally {
    await testDb.close()
  }
})

test('회장이 스스로 내보내면 PRESIDENT_CANNOT_LEAVE(먼저 넘겨야 한다)이고, 부회장이 스스로 내보내면 CANNOT_REMOVE_SELF다. 아무것도 바뀌지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    const president = await api.post(`${base}/members/${member.u1}/remove`, {}, 'u1')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_CANNOT_LEAVE' })
    const vice = await api.post(`${base}/members/${member.u2}/remove`, {}, 'u2')
    assert.equal(vice.status, 409)
    assert.deepEqual(await vice.json(), { error: 'CANNOT_REMOVE_SELF' })
    assert.deepEqual(await presidentsOf(testDb, council.id), [member.u1])
    assert.equal(
      (await testDb.pg.query('SELECT 1 FROM council_membership WHERE ends_at IS NOT NULL')).rows
        .length,
      0,
    )
    // 회장을 넘긴 뒤의 이전 회장은 직급 없는 운영진이라 회장단 요청 자체가 403이다.
    assert.equal(
      (await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u1')).status,
      200,
    )
    assert.equal((await api.post(`${base}/members/${member.u1}/remove`, {}, 'u1')).status, 403)
  } finally {
    await testDb.close()
  }
})

test('경로의 부서 번호나 운영진 번호가 uuid가 아니면 404다: 부서에서 빼기, 부서 배정, 직급 바꾸기', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    assert.equal(
      (await api.post(`${base}/members/${member.u2}/departments/not-a-uuid/remove`, {}, 'u1'))
        .status,
      404,
    )
    assert.equal(
      (await api.post(`${base}/members/not-a-uuid/departments/${finance}/remove`, {}, 'u1')).status,
      404,
    )
    assert.equal(
      (
        await api.post(
          `${base}/members/not-a-uuid/departments`,
          { departmentId: finance, rank: null },
          'u1',
        )
      ).status,
      404,
    )
    assert.equal(
      (await api.post(`${base}/members/not-a-uuid/rank`, { rank: null }, 'u1')).status,
      404,
    )
    assert.equal((await api.post(`${base}/members/%00/rank`, { rank: null }, 'u1')).status, 404)
  } finally {
    await testDb.close()
  }
})

// 부서 옮기기(기능 023 조각 3, DEC-91) ------------------------------------------------------------

// 기획부를 더하고, u2를 재정부 부장, u4를 재정부와 기획부에 직급 없이 넣는다. u3은 부서가 없다.
async function moveSetup(testDb: TestDb) {
  const ctx = await setup(testDb)
  const { api, base, member, finance } = ctx
  const created = (await (
    await api.post(`${base}/departments`, { name: '기획부' }, 'u1')
  ).json()) as TeamResponse
  const planning = created.departments.find(item => item.name === '기획부')!.id
  const assign = async (memberId: string, departmentId: string, rank: string | null) =>
    assert.equal(
      (await api.post(`${base}/members/${memberId}/departments`, { departmentId, rank }, 'u1'))
        .status,
      200,
    )
  await assign(member.u2, finance, 'head')
  await assign(member.u4, finance, null)
  await assign(member.u4, planning, null)
  const move = (memberId: string, body: object, user = 'u1') =>
    api.post(`${base}/members/${memberId}/departments/move`, body, user)
  return { ...ctx, planning, move }
}

// 그 사람의 부서 소속(부서, 직급, 열림)과 부서방 참여. 실패한 요청 뒤 아무것도 바뀌지 않았는지 맞대어 본다.
async function placementState(testDb: TestDb, memberId: string) {
  const placements = (
    await testDb.pg.query<{ department_id: string; department_rank: string | null; open: boolean }>(
      `SELECT department_id, department_rank, ends_at IS NULL AS open FROM department_membership
       WHERE member_id = $1 ORDER BY department_id`,
      [memberId],
    )
  ).rows
  const rooms = (
    await testDb.pg.query(
      `SELECT cr.department_id FROM room_membership rm JOIN chat_room cr ON cr.id = rm.room_id
       WHERE rm.member_id = $1 AND cr.type = 'department' ORDER BY cr.department_id`,
      [memberId],
    )
  ).rows
  return { placements, rooms }
}

test('옮기기: 옛 소속을 끝내고(판) 새 부서 소속을 보낸 직급으로 열며, 부서방도 같은 거래에서 옮기고 새 목록을 돌려준다', async () => {
  const testDb = await createTestDb()
  try {
    const { member, finance, planning, move } = await moveSetup(testDb)
    const [{ id: old }] = (
      await testDb.pg.query<{ id: string }>(
        'SELECT id FROM department_membership WHERE member_id = $1',
        [member.u2],
      )
    ).rows as [{ id: string }]
    const before = await versionsOf(testDb, old)
    const response = await move(member.u2, {
      fromDepartmentId: finance,
      toDepartmentId: planning,
      rank: null,
    })
    assert.equal(response.status, 200)
    const team = (await response.json()) as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [
      { id: planning, rank: null },
    ])
    assert.equal(team.departments.find(item => item.id === finance)!.memberCount, 1)
    assert.equal(team.departments.find(item => item.id === planning)!.memberCount, 2)
    assert.equal(await versionsOf(testDb, old), before + 1)
    assert.deepEqual(await placementState(testDb, member.u2), {
      placements: [
        { department_id: finance, department_rank: 'head', open: false },
        { department_id: planning, department_rank: null, open: true },
      ].sort((a, b) => a.department_id.localeCompare(b.department_id)),
      rooms: [{ department_id: planning }],
    })
    // 되돌리기: 옛 부서와 옛 직급으로 한 요청에 돌아가고, 끝났던 같은 소속을 다시 연다.
    assert.equal(
      (await move(member.u2, { fromDepartmentId: planning, toDepartmentId: finance, rank: 'head' }))
        .status,
      200,
    )
    const back = await placementState(testDb, member.u2)
    assert.deepEqual(
      back.placements.filter(row => row.open),
      [{ department_id: finance, department_rank: 'head', open: true }],
    )
    assert.equal(back.placements.length, 2)
    assert.deepEqual(back.rooms, [{ department_id: finance }])
  } finally {
    await testDb.close()
  }
})

test('옮기기 실패: 같은 부서 400, 옛 소속 없음 404, 이미 든 부서 409, 다른 학생회 부서·사람 404, 모르는 키 400, 로그인 안 함 401, 부원 403이고 아무것도 바뀌지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { member, finance, planning, otherFinance, otherPresident, move } =
      await moveSetup(testDb)
    const snapshot = async () => [
      await placementState(testDb, member.u2),
      await placementState(testDb, member.u3),
      await placementState(testDb, member.u4),
    ]
    const before = await snapshot()
    const body = { fromDepartmentId: finance, toDepartmentId: planning, rank: null }
    const cases: [string, () => ReturnType<typeof move>, number, string?][] = [
      ['같은 부서', () => move(member.u2, { ...body, toDepartmentId: finance }), 400],
      ['옛 소속 없음', () => move(member.u3, body), 404, 'NOT_FOUND'],
      ['이미 든 부서', () => move(member.u4, body), 409, 'ALREADY_IN_DEPARTMENT'],
      [
        '다른 학생회의 새 부서',
        () => move(member.u2, { ...body, toDepartmentId: otherFinance }),
        404,
      ],
      [
        '다른 학생회의 옛 부서',
        () => move(member.u2, { ...body, fromDepartmentId: otherFinance }),
        404,
      ],
      ['다른 학생회의 사람', () => move(otherPresident, body), 404],
      ['모르는 키', () => move(member.u2, { ...body, extra: 1 }), 400],
      ['직급 형식', () => move(member.u2, { ...body, rank: 'president' }), 400],
      ['빠진 칸', () => move(member.u2, { fromDepartmentId: finance, rank: null }), 400],
      ['로그인 안 함', () => move(member.u2, body, ''), 401],
      ['부원', () => move(member.u2, body, 'u3'), 403],
    ]
    for (const [label, send, status, error] of cases) {
      const response = await send()
      assert.equal(response.status, status, label)
      if (error) assert.deepEqual(await response.json(), { error }, label)
    }
    assert.deepEqual(await snapshot(), before)
  } finally {
    await testDb.close()
  }
})

test('옮기기 권한: 직급이 붙은 소속을 옮기거나 새 부서에 직급을 주려면 직급 칸도 필요하다. 아무것도 바뀌지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance, planning, move } = await moveSetup(testDb)
    assert.equal(
      (await api.post(`${base}/members/${member.u3}/rank`, { rank: 'vice_president' }, 'u1'))
        .status,
      200,
    )
    await withRankManageForPresidentOnly(async () => {
      const before = await placementState(testDb, member.u2)
      // 부회장 u3은 member.manage만 있다. 재정부 부장 u2를 옮기지 못한다.
      assert.equal(
        (
          await move(
            member.u2,
            { fromDepartmentId: finance, toDepartmentId: planning, rank: null },
            'u3',
          )
        ).status,
        403,
      )
      assert.deepEqual(await placementState(testDb, member.u2), before)
      // 직급 없는 u4를 새 부서의 부장으로 옮기지 못한다.
      const u4 = await placementState(testDb, member.u4)
      assert.equal(
        (await api.post(`${base}/members/${member.u4}/departments/${planning}/remove`, {}, 'u3'))
          .status,
        200,
      )
      const afterRemove = await placementState(testDb, member.u4)
      assert.equal(
        (
          await move(
            member.u4,
            { fromDepartmentId: finance, toDepartmentId: planning, rank: 'head' },
            'u3',
          )
        ).status,
        403,
      )
      assert.deepEqual(await placementState(testDb, member.u4), afterRemove)
      // 직급 없이 옮기는 것은 member.manage만으로 된다.
      assert.equal(
        (
          await move(
            member.u4,
            { fromDepartmentId: finance, toDepartmentId: planning, rank: null },
            'u3',
          )
        ).status,
        200,
      )
      assert.notDeepEqual(await placementState(testDb, member.u4), u4)
    })
  } finally {
    await testDb.close()
  }
})

test('옮기기 중간에 새 소속 열기가 실패하면 거래 전체가 되돌아가 옛 부서에 그대로 있다(두 부서에도, 어디에도 없지 않다)', async () => {
  const testDb = await createTestDb()
  try {
    const { member, finance, planning, move } = await moveSetup(testDb)
    const before = await placementState(testDb, member.u2)
    // 옛 소속을 끝낸 뒤, 새 부서 소속을 쓰는 순간 DB가 거부한다.
    await testDb.pg.exec(`
      CREATE FUNCTION refuse_planning() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.department_id = '${planning}' THEN RAISE EXCEPTION 'refused'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER refuse_planning BEFORE INSERT OR UPDATE ON department_membership
        FOR EACH ROW EXECUTE FUNCTION refuse_planning();
    `)
    const response = await move(member.u2, {
      fromDepartmentId: finance,
      toDepartmentId: planning,
      rank: null,
    })
    assert.equal(response.status, 500)
    assert.deepEqual(await placementState(testDb, member.u2), before)
  } finally {
    await testDb.close()
  }
})
