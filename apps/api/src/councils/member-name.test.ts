import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { createRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createCouncilRoutes } from './routes.js'

// 만들기와 들어오기의 '내 이름'(memberName): 로그인에 처음 운영진을 이을 때만 쓴다(DEC-87).
// 2026-10-19 12:00 KST
const noon = new Date('2026-10-19T03:00:00Z')
const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}

function appOf(testDb: TestDb) {
  return caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession, () => noon),
      invites: createInviteRoutes(testDb.db, testSession, () => noon),
    }),
  )
}

// 그 로그인에 이어진 운영진의 이름과 판 수
async function memberOf(testDb: TestDb, userId: string) {
  const { rows } = await testDb.pg.query<{ name: string; versions: number; changed_by: string }>(
    `SELECT m.name, (SELECT count(*)::int FROM record_version v WHERE v.record_id = m.id) AS versions,
       (SELECT v.changed_by FROM record_version v WHERE v.record_id = m.id ORDER BY v.version_no DESC LIMIT 1) AS changed_by
     FROM member m JOIN member_login ml ON ml.member_id = m.id WHERE ml.user_id = $1`,
    [userId],
  )
  return rows[0]
}

// 아직 로그인에 이어지지 않은, 같은 이메일의 운영진(회장단이 미리 넣어 둔 사람과 같다)
async function unlinkedMember(testDb: TestDb, name: string, email: string) {
  return testDb.db.transaction(tx =>
    createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name, email } }),
  )
}

async function inviteCodeOf(testDb: TestDb, userId: string) {
  const api = appOf(testDb)
  const { council } = (await (
    await api.post('/api/organizations/create', body, userId)
  ).json()) as CreateCouncilResponse
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, userId)
  ).json()) as InviteCodeResponse
  return code
}

test('이어진 운영진이 없는 사람이 내 이름을 보내 만들면 그 이름의 운영진이 되고, 빼면 Google 이름이다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { name: 'Kim HS' })
    await addUser(testDb.pg, 'u2', { name: 'Lee' })
    const api = appOf(testDb)
    const named = await api.post(
      '/api/organizations/create',
      { ...body, memberName: ' 김회장 ' },
      'u1',
    )
    assert.equal(named.status, 201)
    assert.deepEqual(await memberOf(testDb, 'u1'), {
      name: '김회장',
      versions: 1,
      changed_by: null,
    })
    assert.equal((await api.post('/api/organizations/create', body, 'u2')).status, 201)
    assert.equal((await memberOf(testDb, 'u2'))?.name, 'Lee')
  } finally {
    await testDb.close()
  }
})

test('이메일로 이어지는 운영진이면 만들기와 들어오기의 내 이름으로 바뀌고 판이 하나 는다(바꾼 사람 그 운영진). 같은 이름이면 판이 늘지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { email: 'kim@example.test' })
    await addUser(testDb.pg, 'u2', { email: 'lee@example.test' })
    await addUser(testDb.pg, 'u3', { email: 'park@example.test' })
    await addUser(testDb.pg, 'chief')
    const kim = await unlinkedMember(testDb, '김 예전', 'kim@example.test')
    const lee = await unlinkedMember(testDb, '이 예전', 'lee@example.test')
    await unlinkedMember(testDb, '박운영', 'park@example.test')
    const api = appOf(testDb)
    const made = await api.post(
      '/api/organizations/create',
      { ...body, memberName: '김회장' },
      'u1',
    )
    assert.equal(made.status, 201)
    assert.deepEqual(await memberOf(testDb, 'u1'), { name: '김회장', versions: 2, changed_by: kim })
    const code = await inviteCodeOf(testDb, 'chief')
    const joined = await api.post('/api/organizations/join', { code, memberName: '이운영' }, 'u2')
    assert.equal(joined.status, 200)
    assert.deepEqual(await memberOf(testDb, 'u2'), { name: '이운영', versions: 2, changed_by: lee })
    // 같은 이름이면 판을 만들지 않는다.
    await api.post('/api/organizations/join', { code, memberName: '박운영' }, 'u3')
    assert.deepEqual(await memberOf(testDb, 'u3'), {
      name: '박운영',
      versions: 1,
      changed_by: null,
    })
  } finally {
    await testDb.close()
  }
})

test('이미 이어진 사람이 내 이름을 보내 만들거나 들어오면 이름은 그대로다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', { name: '김회장' })
    await addUser(testDb.pg, 'chief')
    const api = appOf(testDb)
    assert.equal((await api.post('/api/organizations/create', body, 'u1')).status, 201)
    const second = await api.post(
      '/api/organizations/create',
      { ...body, name: '경영학부 학생회', memberName: '다른 이름' },
      'u1',
    )
    assert.equal(second.status, 201)
    const code = await inviteCodeOf(testDb, 'chief')
    const joined = await api.post(
      '/api/organizations/join',
      { code, memberName: '또 다른 이름' },
      'u1',
    )
    assert.equal(joined.status, 200)
    assert.deepEqual(await memberOf(testDb, 'u1'), {
      name: '김회장',
      versions: 1,
      changed_by: null,
    })
  } finally {
    await testDb.close()
  }
})

test('이어진 운영진이 없는 사람이 내 이름을 보내 들어오면 그 이름의 운영진이 된다. 이름이 틀리면 400이고 들어오지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'chief')
    await addUser(testDb.pg, 'u2', { name: 'Google Name' })
    const code = await inviteCodeOf(testDb, 'chief')
    const api = appOf(testDb)
    for (const memberName of ['', '  ', '😀'.repeat(51), 'a\u0000', '\uD800']) {
      const response = await api.post('/api/organizations/join', { code, memberName }, 'u2')
      assert.equal(response.status, 400, JSON.stringify(memberName))
    }
    assert.equal(await memberOf(testDb, 'u2'), undefined)
    const joined = await api.post('/api/organizations/join', { code, memberName: '이운영' }, 'u2')
    assert.equal(joined.status, 200)
    assert.deepEqual(await memberOf(testDb, 'u2'), {
      name: '이운영',
      versions: 1,
      changed_by: null,
    })
  } finally {
    await testDb.close()
  }
})
