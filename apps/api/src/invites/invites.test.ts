import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, InvitePreviewResponse, JoinCouncilResponse, MyCouncilsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createInviteRoutes } from './routes.js'

const noon = new Date('2026-10-19T03:00:00Z')
const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

function appOf(testDb: TestDb, now = noon) {
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, () => now), invites: createInviteRoutes(testDb.db, testSession, () => now) }))
}

// 회장(u1)이 학생회를 만들고 초대 코드를 받는다.
async function setup(testDb: TestDb, users = ['u1', 'u2', 'u3']) {
  for (const user of users) await addUser(testDb.pg, user, `이름 ${user}`)
  const api = appOf(testDb)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  return { api, council, code }
}

// 한 행만 나와야 하는 조회의 그 행
function one<T>(rows: T[]): T {
  assert.equal(rows.length, 1)
  return rows[0]!
}

const membershipsOf = (testDb: TestDb, userId: string) => testDb.pg.query<{ id: string; council_rank: string | null; ends_at: string | null; starts_at: string }>(
  `SELECT cm.id, cm.council_rank, cm.ends_at::text, cm.starts_at::text FROM council_membership cm
   JOIN member_login ml ON ml.member_id = cm.member_id WHERE ml.user_id = $1`, [userId])

test('초대 확인은 학생회 이름과 이미 들어왔는지만 보여 주고, 코드는 공백·하이픈·소문자를 정규화한다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
    assert.deepEqual(await (await api.get(`/api/invites/${encodeURIComponent(typed)}`, 'u2')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: false })
    assert.deepEqual(await (await api.get(`/api/invites/${code}`, 'u1')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: true })
    for (const wrong of ['ZZZZ2222', '%00', 'A'.repeat(17)]) assert.equal((await api.get(`/api/invites/${wrong}`, 'u2')).status, 404, wrong)
    assert.equal((await api.get(`/api/invites/${code}`)).status, 401)
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
    assert.deepEqual(await response.json() as JoinCouncilResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] } })
    const [joined] = (await membershipsOf(testDb, 'u2')).rows
    assert.deepEqual({ ...joined, id: undefined, starts_at: undefined }, { id: undefined, council_rank: null, ends_at: null, starts_at: undefined })
    // 들어온 사람이 자기 소속 기록을 만든 사람이다.
    assert.deepEqual((await testDb.pg.query(`SELECT r.created_by = ml.member_id AS self FROM record r, member_login ml
      WHERE r.id = $1 AND ml.user_id = 'u2'`, [joined!.id])).rows, [{ self: true }])
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 1)
    assert.equal((await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [joined!.id])).rows.length, 1)
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse,
      { councils: [{ id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] }] })
  } finally {
    await testDb.close()
  }
})

test('두 탭에서 동시에 들어와도 소속과 판은 하나이고 둘 다 200이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, code } = await setup(testDb)
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all([api.post('/api/organizations/join', { code }, 'u2'), api.post('/api/organizations/join', { code }, 'u2')])
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    const memberships = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(memberships.length, 1)
    assert.equal((await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [memberships[0]!.id])).rows.length, 1)
    assert.equal((await testDb.pg.query("SELECT 1 FROM member_login WHERE user_id = 'u2'")).rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('내보내졌던 사람이 다시 들어오면 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않고, 끝났던 상태는 판에 남는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id: membershipId, starts_at: firstStart } = one((await membershipsOf(testDb, 'u2')).rows)
    // 부회장이자 재정부원이던 사람을 내보낸다(내보내기 경로는 다음 작업에서 만든다. 여기서는 기록 모듈로 같은 변경을 한다).
    // 거래 안에서는 tx만 쓴다. 거래 밖의 pg.query를 부르면 PGlite가 거래가 끝나기를 기다려 멈춘다.
    const { cohort_id: cohortId, member_id: memberId } = one((await testDb.pg.query<{ cohort_id: string; member_id: string }>(
      'SELECT cohort_id, member_id FROM council_membership WHERE id = $1', [membershipId])).rows)
    const { id: finance } = one((await testDb.pg.query<{ id: string }>("SELECT id FROM department WHERE role = 'finance'")).rows)
    await testDb.db.transaction(async tx => {
      await updateRecord(tx, { kind: 'council_membership', id: membershipId, actor: null, reason: null, changes: { councilRank: 'vice_president' } })
      const placement = await createRecord(tx, { kind: 'department_membership', councilId: council.id, actor: null,
        values: { memberId, departmentId: finance, cohortId, startsAt: clockNow } })
      await updateRecord(tx, { kind: 'department_membership', id: placement, actor: null, reason: null, changes: { endsAt: clockNow } })
      await updateRecord(tx, { kind: 'council_membership', id: membershipId, actor: null, reason: null, changes: { endsAt: clockNow } })
    })
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse, { councils: [] })
    assert.deepEqual(await (await api.get(`/api/invites/${code}`, 'u2')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: false })
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    const [reopened] = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(reopened!.id, membershipId)
    assert.equal(reopened!.council_rank, null)
    assert.equal(reopened!.ends_at, null)
    assert.ok(reopened!.starts_at > firstStart)
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse,
      { councils: [{ id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] }] })
    const versions = await testDb.pg.query<{ rank: string | null; ended: boolean }>(
      "SELECT data->>'council_rank' AS rank, data->>'ends_at' IS NOT NULL AS ended FROM record_version WHERE record_id = $1 ORDER BY version_no", [membershipId])
    assert.deepEqual(versions.rows, [{ rank: null, ended: false }, { rank: 'vice_president', ended: false }, { rank: 'vice_president', ended: true },
      { rank: null, ended: false }])
  } finally {
    await testDb.close()
  }
})

test('초대 코드 보기와 바꾸기는 회장단만 한다. 바꾸면 옛 코드는 막히고 새 코드로 들어온다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb, ['u1', 'u2', 'u3', 'u4'])
    await api.post('/api/organizations/join', { code }, 'u2')
    const other = (await (await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u4')).json() as CreateCouncilResponse).council
    for (const user of ['u2', 'u4']) {
      assert.equal((await api.get(`/api/organizations/${council.id}/invite`, user)).status, 403, user)
      assert.equal((await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)).status, 403, user)
    }
    assert.equal((await api.get(`/api/organizations/${other.id}/invite`, 'u1')).status, 403)
    assert.equal((await api.post(`/api/organizations/${council.id}/invite/rotate`, {})).status, 401)
    const rotated = await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, 'u1')
    assert.equal(rotated.status, 200)
    const { code: next } = await rotated.json() as InviteCodeResponse
    assert.match(next, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.notEqual(next, code)
    assert.deepEqual(await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse, { code: next })
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
    await testDb.db.transaction(tx => updateRecord(tx, { kind: 'council_membership', id, actor: null, reason: null, changes: { councilRank: 'vice_president' } }))
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all(['u1', 'u2'].map(user => api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)))
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    const codes = await Promise.all(responses.map(async response => (await response.json() as InviteCodeResponse).code))
    const stored = (await testDb.pg.query<{ code: string }>('SELECT code FROM invite_code WHERE council_id = $1', [council.id])).rows
    assert.equal(stored.length, 1)
    assert.ok(codes.includes(stored[0]!.code))
    for (const used of [code, ...codes.filter(item => item !== stored[0]!.code)]) assert.equal((await api.get(`/api/invites/${used}`, 'u3')).status, 404)
  } finally {
    await testDb.close()
  }
})

test('지금 기수가 없으면 409 NO_CURRENT_COHORT이고, 들어오기 입력이 틀리면 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { code } = await setup(testDb)
    const nextYear = appOf(testDb, new Date('2027-03-01T03:00:00Z'))
    const late = await nextYear.post('/api/organizations/join', { code }, 'u2')
    assert.equal(late.status, 409)
    assert.deepEqual(await late.json(), { error: 'NO_CURRENT_COHORT' })
    const api = appOf(testDb)
    for (const bad of [{}, { code: '' }, { code: '   ' }, { code: 'A'.repeat(17) }, { code: 'AB\u0000CD' }, { code: '\uD800' }, { code, extra: 1 }]) {
      assert.equal((await api.post('/api/organizations/join', bad, 'u2')).status, 400, JSON.stringify(bad))
    }
    assert.equal((await api.post('/api/organizations/join', { code })).status, 401)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})
