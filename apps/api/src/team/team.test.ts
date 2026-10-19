import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

const noon = new Date('2026-10-19T03:00:00Z')
const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

function appOf(testDb: TestDb) {
  const clock = () => noon
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, clock), invites: createInviteRoutes(testDb.db, testSession, clock),
    team: createTeamRoutes(testDb.db, testSession, clock) }))
}

// 회장 u1이 학생회를 만들고 u2·u3·u4가 초대로 들어온다. u5는 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2', 'u3', 'u4', 'u5']) await addUser(testDb.pg, user, `이름 ${user}`, `${user}@example.test`)
  const api = appOf(testDb)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  for (const user of ['u2', 'u3', 'u4']) await api.post('/api/organizations/join', { code }, user)
  const { council: other } = await (await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u5')).json() as CreateCouncilResponse
  const team = await (await api.get(`/api/organizations/${council.id}/members`, 'u1')).json() as TeamResponse
  const otherTeam = await (await api.get(`/api/organizations/${other.id}/members`, 'u5')).json() as TeamResponse
  const id = (user: string) => team.members.find(item => item.name === `이름 ${user}`)!.id
  const base = `/api/organizations/${council.id}`
  return { api, base, council, other, finance: team.departments[0]!.id, otherFinance: otherTeam.departments[0]!.id,
    otherPresident: otherTeam.members[0]!.id, member: { u1: id('u1'), u2: id('u2'), u3: id('u3'), u4: id('u4') } }
}

// 그 학생회의 끝나지 않은 회장 소속
const presidentsOf = async (testDb: TestDb, councilId: string) => (await testDb.pg.query<{ member_id: string }>(
  `SELECT cm.member_id FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
   WHERE co.council_id = $1 AND cm.council_rank = 'president' AND cm.ends_at IS NULL`, [councilId])).rows.map(row => row.member_id)

const versionsOf = async (testDb: TestDb, recordId: string) => (await testDb.pg.query<{ version_no: number }>(
  'SELECT version_no FROM record_version WHERE record_id = $1', [recordId])).rows.length

test('운영진 목록: 모든 운영진이 들어온 순서대로 이름, 직급, 부서, 들어온 시각을 보고 이메일은 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const response = await api.get(`${base}/members`, 'u3')
    assert.equal(response.status, 200)
    const team = await response.json() as TeamResponse
    assert.deepEqual(team.members.map(item => [item.id, item.name, item.councilRank, item.departments]), [
      [member.u1, '이름 u1', 'president', []], [member.u2, '이름 u2', null, []], [member.u3, '이름 u3', null, []], [member.u4, '이름 u4', null, []]])
    assert.ok(team.members.every(item => !Number.isNaN(Date.parse(item.joinedAt))))
    assert.deepEqual(team.departments, [{ id: finance, name: '재정부', role: 'finance', memberCount: 0 }])
    assert.ok(!JSON.stringify(team).includes('@'))
    assert.deepEqual(Object.keys(team.members[0]!).sort(), ['councilRank', 'departments', 'id', 'joinedAt', 'name'])
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
    const assign = (rank: string | null) => api.post(`${base}/members/${member.u2}/departments`, { departmentId: finance, rank }, 'u1')
    let team = await (await assign('head')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: 'head' }])
    assert.equal(team.departments[0]!.memberCount, 1)
    const [{ id: placement }] = (await testDb.pg.query<{ id: string }>('SELECT id FROM department_membership')).rows as [{ id: string }]
    team = await (await assign('vice_head')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: 'vice_head' }])
    assert.equal((await assign('vice_head')).status, 200)
    assert.equal(await versionsOf(testDb, placement), 2)
    team = await (await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [])
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal((await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1')).status, 404)
    team = await (await assign(null)).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: null }])
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
    assert.equal((await api.post(`${base}/members/${member.u2}/departments`, { departmentId: otherFinance, rank: null }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/${otherPresident}/departments`, { departmentId: finance, rank: null }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/${otherPresident}/remove`, {}, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: otherPresident }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/not-a-uuid/remove`, {}, 'u1')).status, 404)
    for (const payload of [{}, { departmentId: 'probe', rank: null }, { departmentId: finance, rank: 'president' }, { departmentId: finance, rank: null, extra: 1 }]) {
      assert.equal((await api.post(`${base}/members/${member.u2}/departments`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    for (const payload of [{ rank: 'president' }, {}, { rank: null, extra: 1 }]) {
      assert.equal((await api.post(`${base}/members/${member.u2}/rank`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    assert.equal((await api.post(`${base}/members/${member.u2}/remove`, { reason: 'x' }, 'u1')).status, 400)
  } finally {
    await testDb.close()
  }
})

test('부회장을 주면 회장단 권한이 생기고, 거두면 다음 요청부터 막힌다. 회장의 직급은 이 경로로 바꿀 수 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const team = await (await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')).json() as TeamResponse
    assert.equal(team.members.find(item => item.id === member.u2)!.councilRank, 'vice_president')
    assert.equal((await api.post(`${base}/members/${member.u3}/departments`, { departmentId: finance, rank: 'head' }, 'u2')).status, 200)
    const president = await api.post(`${base}/members/${member.u1}/rank`, { rank: null }, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_REQUIRED' })
    assert.equal((await api.post(`${base}/members/${member.u2}/rank`, { rank: null }, 'u1')).status, 200)
    assert.equal((await api.post(`${base}/members/${member.u3}/departments/${finance}/remove`, {}, 'u2')).status, 403)
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기는 회장만 한다. 넘긴 사람은 직급 없음이 되고, 자기에게 넘기면 409다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u2')).status, 403)
    const self = await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'ALREADY_PRESIDENT' })
    const team = await (await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u1')).json() as TeamResponse
    assert.deepEqual(team.members.map(item => item.councilRank), [null, 'vice_president', 'president', null])
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')).status, 403)
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
    await api.post(`${base}/members/${member.u4}/departments`, { departmentId: finance, rank: 'head' }, 'u1')
    const president = await api.post(`${base}/members/${member.u1}/remove`, {}, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_CANNOT_LEAVE' })
    const self = await api.post(`${base}/members/${member.u2}/remove`, {}, 'u2')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'CANNOT_REMOVE_SELF' })
    assert.equal((await api.get(base, 'u4')).status, 200)
    const team = await (await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')).json() as TeamResponse
    assert.ok(!team.members.some(item => item.id === member.u4))
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal((await testDb.pg.query('SELECT 1 FROM department_membership WHERE ends_at IS NULL')).rows.length, 0)
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
    assert.ok([[200, 409], [404, 200]].some(([a, b]) => transfer.status === a && removal.status === b), `${transfer.status} ${removal.status}`)
    const presidents = await presidentsOf(testDb, council.id)
    assert.equal(presidents.length, 1)
    const removed = (await testDb.pg.query('SELECT 1 FROM council_membership WHERE member_id = $1 AND ends_at IS NOT NULL', [member.u4])).rows.length === 1
    assert.equal(presidents[0], removed ? member.u1 : member.u4)
  } finally {
    await testDb.close()
  }
})
