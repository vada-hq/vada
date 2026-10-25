import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  CreateCouncilResponse,
  InviteCodeResponse,
  MeProfileResponse,
  TeamResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { createTeamRoutes } from '../team/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createProfileRoutes } from './routes.js'

// 2026-10-19 12:00 KST
const noon = new Date('2026-10-19T03:00:00Z')
const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}

function appOf(testDb: TestDb) {
  const clock = () => noon
  return caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession, clock),
      invites: createInviteRoutes(testDb.db, testSession, clock),
      team: createTeamRoutes(testDb.db, testSession, clock),
      profile: createProfileRoutes(testDb.db, testSession),
    }),
  )
}

// 회장 u1, u3이 학생회를 하나씩 만들고 u2가 둘 다에 들어온다.
async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user, { name: `이름 ${user}` })
  const api = appOf(testDb)
  const councils: string[] = []
  for (const [chief, name] of [
    ['u1', '컴퓨터학부 학생회'],
    ['u3', '경영학부 학생회'],
  ] as const) {
    const { council } = (await (
      await api.post('/api/organizations/create', { ...body, name }, chief)
    ).json()) as CreateCouncilResponse
    const { code } = (await (
      await api.get(`/api/organizations/${council.id}/invite`, chief)
    ).json()) as InviteCodeResponse
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    councils.push(council.id)
  }
  return { api, councils }
}

const versionsOf = async (testDb: TestDb, userId: string) =>
  (
    await testDb.pg.query<{ version_no: number; changed_by: string | null; self: boolean }>(
      `SELECT v.version_no, v.changed_by = ml.member_id AS self FROM record_version v
       JOIN member_login ml ON ml.member_id = v.record_id WHERE ml.user_id = $1 ORDER BY v.version_no`,
      [userId],
    )
  ).rows.map(row => ({ version_no: row.version_no, self: row.self }))

test('내 이름 읽기: 이어지기 전에는 null이고, 이어진 뒤에는 운영진 이름이다. 응답은 no-store다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { name: 'Kim HS' })
    const api = appOf(testDb)
    const before = await api.get('/api/me/profile', 'u1')
    assert.equal(before.status, 200)
    assert.equal(before.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual((await before.json()) as MeProfileResponse, { name: null })
    await api.post('/api/organizations/create', { ...body, memberName: '김회장' }, 'u1')
    assert.deepEqual((await (await api.get('/api/me/profile', 'u1')).json()) as MeProfileResponse, {
      name: '김회장',
    })
  } finally {
    await testDb.close()
  }
})

test('내 이름 고치기: 판을 남기고(바꾼 사람 나) 그 사람이 든 모든 학생회의 운영진 목록에 보인다. 같은 이름이면 판이 늘지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, councils } = await setup(testDb)
    const response = await api.post('/api/me/profile', { name: ' 이운영 ' }, 'u2')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual((await response.json()) as MeProfileResponse, { name: '이운영' })
    assert.deepEqual(await versionsOf(testDb, 'u2'), [
      { version_no: 1, self: null },
      { version_no: 2, self: true },
    ])
    for (const [councilId, chief] of [
      [councils[0]!, 'u1'],
      [councils[1]!, 'u3'],
    ]) {
      const team = (await (
        await api.get(`/api/organizations/${councilId}/members`, chief)
      ).json()) as TeamResponse
      const names = team.members.map(member => member.name)
      assert.ok(names.includes('이운영'), councilId)
      assert.ok(!names.includes('이름 u2'), councilId)
    }
    // 다른 사람의 이름은 그대로다.
    assert.deepEqual((await (await api.get('/api/me/profile', 'u1')).json()) as MeProfileResponse, {
      name: '이름 u1',
    })
    const same = await api.post('/api/me/profile', { name: '이운영' }, 'u2')
    assert.equal(same.status, 200)
    assert.equal((await versionsOf(testDb, 'u2')).length, 2)
  } finally {
    await testDb.close()
  }
})

test('내 이름 고치기: 이어진 운영진이 없으면 404, 빈 이름·51자(이모지)·NUL·서러게이트·모르는 키는 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    await addUser(testDb.pg, 'u9')
    const api = appOf(testDb)
    await api.post('/api/organizations/create', body, 'u1')
    const missing = await api.post('/api/me/profile', { name: '아무개' }, 'u9')
    assert.equal(missing.status, 404)
    assert.deepEqual(await missing.json(), { error: 'NOT_FOUND' })
    assert.equal(
      (await testDb.pg.query("SELECT 1 FROM member WHERE name = '아무개'")).rows.length,
      0,
    )
    for (const bad of [
      {},
      { name: '' },
      { name: '   ' },
      { name: '😀'.repeat(51) },
      { name: '김\u0000' },
      { name: '\uD800' },
      { name: '김회장', extra: 1 },
    ]) {
      const response = await api.post('/api/me/profile', bad, 'u1')
      assert.equal(response.status, 400, JSON.stringify(bad))
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    assert.equal((await versionsOf(testDb, 'u1')).length, 1)
    assert.equal((await api.get('/api/me/profile')).status, 401)
    assert.equal((await api.post('/api/me/profile', { name: '김회장' })).status, 401)
  } finally {
    await testDb.close()
  }
})
