import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultDepartmentColor,
  type CreateCouncilResponse,
  type InviteCodeResponse,
  type TeamResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'
import { createInviteRoutes } from '../invites/routes.js'

async function setup(testDb: TestDb) {
  const clock = () => new Date('2026-10-19T03:00:00Z')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession, clock),
      team: createTeamRoutes(testDb.db, testSession, clock),
      invites: createInviteRoutes(testDb.db, testSession, clock),
    }),
  )
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user, { name: user })
  const body = { name: '색상 학생회', unit: 'department', schoolName: '시험 학교', year: 2026 }
  const councils = []
  for (const user of ['u1', 'u2'])
    councils.push(
      (
        (await (
          await api.post('/api/organizations/create', body, user)
        ).json()) as CreateCouncilResponse
      ).council,
    )
  const base = `/api/organizations/${councils[0]!.id}`
  const other = `/api/organizations/${councils[1]!.id}`
  const { code } = (await (await api.get(`${base}/invite`, 'u1')).json()) as InviteCodeResponse
  await api.post('/api/organizations/join', { code }, 'u3')
  const team = (await (await api.get(`${base}/members`, 'u1')).json()) as TeamResponse
  const otherTeam = (await (await api.get(`${other}/members`, 'u2')).json()) as TeamResponse
  return { api, base, department: team.departments[0]!, otherDepartment: otherTeam.departments[0]! }
}

test('기본색은 ID에 고정되고 선택색은 목록·새 조회와 판에 저장된다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, department } = await setup(testDb)
    assert.equal(department.color, defaultDepartmentColor(department.id))
    const path = `${base}/departments/${department.id}/color`
    const response = await api.post(path, { color: 'orange' }, 'u1')
    assert.equal(response.status, 200)
    const changed = (await response.json()) as TeamResponse
    assert.equal(changed.departments[0]!.color, 'orange')
    assert.equal(
      ((await (await api.get(`${base}/members`, 'u3')).json()) as TeamResponse).departments[0]!
        .color,
      'orange',
    )
    assert.equal((await api.post(path, { color: 'orange' }, 'u1')).status, 200)
    const versions = await testDb.pg.query<{ color: string | null }>(
      "SELECT data->>'color' AS color FROM record_version WHERE record_id=$1 ORDER BY version_no",
      [department.id],
    )
    assert.deepEqual(versions.rows, [{ color: null }, { color: 'orange' }])
    const updated = await api.post(
      `${base}/departments/${department.id}`,
      { name: '재정국', role: null },
      'u1',
    )
    assert.equal(((await updated.json()) as TeamResponse).departments[0]!.color, 'orange')
  } finally {
    await testDb.close()
  }
})

test('색상 변경은 미인증·다른 학생회·다른 학생회 부서를 거절하고 입력은 허용 팔레트만 받는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, department, otherDepartment } = await setup(testDb)
    const path = `${base}/departments/${department.id}/color`
    assert.equal((await api.post(path, { color: 'teal' })).status, 401)
    assert.equal((await api.post(path, { color: 'teal' }, 'u2')).status, 403)
    assert.equal((await api.post(path, { color: 'teal' }, 'u3')).status, 403)
    assert.equal(
      (await api.post(`${base}/departments/${otherDepartment.id}/color`, { color: 'teal' }, 'u1'))
        .status,
      404,
    )
    for (const body of [
      {},
      { color: '' },
      { color: ' ' },
      { color: '#ffffff' },
      { color: 'teal', extra: 1 },
      { color: '\u0000' },
      { color: '\uD800' },
      { color: '😀'.repeat(100) },
    ])
      assert.equal((await api.post(path, body, 'u1')).status, 400)
    await assert.rejects(
      testDb.pg.query('UPDATE department SET color=$1 WHERE id=$2', ['#ffffff', department.id]),
    )
  } finally {
    await testDb.close()
  }
})
