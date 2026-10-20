import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'
import { deleteDepartment } from './service.js'

const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  cohortName: '2026',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
}

// 회장 u1의 학생회에 u2가 들어온다. u3은 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  const clock = () => new Date('2026-10-19T03:00:00Z')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession, clock),
      invites: createInviteRoutes(testDb.db, testSession, clock),
      team: createTeamRoutes(testDb.db, testSession, clock),
    }),
  )
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user, { name: `이름 ${user}` })
  const { council } = (await (
    await api.post('/api/organizations/create', body, 'u1')
  ).json()) as CreateCouncilResponse
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, 'u1')
  ).json()) as InviteCodeResponse
  await api.post('/api/organizations/join', { code }, 'u2')
  const { council: other } = (await (
    await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u3')
  ).json()) as CreateCouncilResponse
  const otherTeam = (await (
    await api.get(`/api/organizations/${other.id}/members`, 'u3')
  ).json()) as TeamResponse
  const base = `/api/organizations/${council.id}`
  const create = async (name: string) =>
    (
      (await (await api.post(`${base}/departments`, { name }, 'u1')).json()) as TeamResponse
    ).departments.find(item => item.name === name)!.id
  return { api, base, council, create, otherDepartment: otherTeam.departments[0]!.id }
}

test('부서 만들기, 이름 바꾸기, 재정 역할 주고 거두기는 회장단이 하고 판을 남긴다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create } = await setup(testDb)
    const planning = await create('기획부')
    let team = (await (
      await api.post(`${base}/departments/${planning}`, { name: '기획국', role: 'finance' }, 'u1')
    ).json()) as TeamResponse
    assert.deepEqual(
      team.departments.map(item => [item.name, item.role, item.memberCount]),
      [
        ['재정부', 'finance', 0],
        ['기획국', 'finance', 0],
      ],
    )
    team = (await (
      await api.post(`${base}/departments/${planning}`, { name: '기획국', role: null }, 'u1')
    ).json()) as TeamResponse
    assert.equal(team.departments.find(item => item.id === planning)!.role, null)
    assert.equal(
      (await api.post(`${base}/departments/${planning}`, { name: '기획국', role: null }, 'u1'))
        .status,
      200,
    )
    const versions = await testDb.pg.query<{ name: string; role: string | null }>(
      "SELECT data->>'name' AS name, data->>'role' AS role FROM record_version WHERE record_id = $1 ORDER BY version_no",
      [planning],
    )
    assert.deepEqual(versions.rows, [
      { name: '기획부', role: null },
      { name: '기획국', role: 'finance' },
      { name: '기획국', role: null },
    ])
  } finally {
    await testDb.close()
  }
})

test('같은 이름의 부서는 409 DEPARTMENT_NAME_TAKEN이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create } = await setup(testDb)
    const planning = await create('기획부')
    for (const response of [
      await api.post(`${base}/departments`, { name: '재정부' }, 'u1'),
      await api.post(`${base}/departments/${planning}`, { name: '재정부', role: null }, 'u1'),
    ]) {
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'DEPARTMENT_NAME_TAKEN' })
    }
  } finally {
    await testDb.close()
  }
})

// 거래가 끝날 때 제약 위반(SQLSTATE)이 난 것처럼 던지는 DB. 라우트가 어떤 위반을 어떤 오류로 바꾸는지만 본다.
const violating = (db: TestDb['db'], code: string): TestDb['db'] =>
  new Proxy(db, {
    get(target, property) {
      if (property === 'transaction')
        return () => Promise.reject(new Error('제약 위반', { cause: { code } }))
      return Reflect.get(target, property, target) as unknown
    },
  })

test('부서 길은 자기가 낼 수 있는 제약 위반만 409로 바꾸고, 다른 위반은 500이다', async t => {
  t.mock.method(console, 'error', () => {})
  const testDb = await createTestDb()
  try {
    const base = `/api/organizations/${randomUUID()}`
    const department = randomUUID()
    const nameRoutes = [
      [`${base}/departments`, { name: '홍보부' }],
      [`${base}/departments/${department}`, { name: '홍보국', role: null }],
    ] as const
    const deleteRoute = [`${base}/departments/${department}/delete`, {}] as const
    const apiOf = (code: string) =>
      caller(
        createApp({
          auth: { handler: async () => new Response() },
          trustedOrigin: ORIGIN,
          team: createTeamRoutes(violating(testDb.db, code), testSession),
        }),
      )
    // 이름이 겹치면 23505, 다른 기록이 부서를 가리키면 23503이다.
    for (const [path, payload] of nameRoutes) {
      const response = await apiOf('23505').post(path, payload, 'u1')
      assert.equal(response.status, 409, path)
      assert.deepEqual(await response.json(), { error: 'DEPARTMENT_NAME_TAKEN' })
      assert.equal((await apiOf('23503').post(path, payload, 'u1')).status, 500, path)
    }
    const [path, payload] = deleteRoute
    const response = await apiOf('23503').post(path, payload, 'u1')
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'DEPARTMENT_IN_USE' })
    assert.equal((await apiOf('23505').post(path, payload, 'u1')).status, 500)
  } finally {
    await testDb.close()
  }
})

test('쓰인 적 없는 부서만 없앤다: 판, 하위 행, 기록 행을 함께 지우고, 한 번이라도 쓰인 부서는 409 DEPARTMENT_IN_USE다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    const { api, base, council, create } = await setup(testDb)
    const unused = await create('홍보부')
    await api.post(`${base}/departments/${unused}`, { name: '홍보국', role: null }, 'u1')
    const team = (await (
      await api.post(`${base}/departments/${unused}/delete`, {}, 'u1')
    ).json()) as TeamResponse
    assert.ok(!team.departments.some(item => item.id === unused))
    for (const table of ['department', 'record', 'record_version']) {
      assert.equal(
        (
          await pg.query(
            `SELECT 1 FROM ${table} WHERE ${table === 'record_version' ? 'record_id' : 'id'} = $1`,
            [unused],
          )
        ).rows.length,
        0,
        table,
      )
    }
    // 부서원이 들어왔다가 빠진 부서
    const used = await create('복지부')
    const lee = team.members.find(item => item.name === '이름 u2')!.id
    await api.post(`${base}/members/${lee}/departments`, { departmentId: used, rank: null }, 'u1')
    await api.post(`${base}/members/${lee}/departments/${used}/remove`, {}, 'u1')
    const blocked = await api.post(`${base}/departments/${used}/delete`, {}, 'u1')
    assert.equal(blocked.status, 409)
    assert.deepEqual(await blocked.json(), { error: 'DEPARTMENT_IN_USE' })
    // 다른 기록(업무)이 가리키는 부서는 외래 키가 막는다.
    const tasked = await create('체육부')
    const [{ id: taskId }] = (
      await pg.query<{ id: string }>(
        "INSERT INTO record (kind, council_id) VALUES ('task', $1) RETURNING id",
        [council.id],
      )
    ).rows as [{ id: string }]
    await pg.query(
      "INSERT INTO task (id, title, status, department_id) VALUES ($1, '현수막', 'open', $2)",
      [taskId, tasked],
    )
    const referenced = await api.post(`${base}/departments/${tasked}/delete`, {}, 'u1')
    assert.equal(referenced.status, 409)
    assert.deepEqual(await referenced.json(), { error: 'DEPARTMENT_IN_USE' })
    // 외래 키가 막은 것은 마지막 단계(부서 행)다. 그 앞에서 지운 판과 기록 행도 거래째 되돌아와야 한다.
    for (const table of ['department', 'record', 'record_version']) {
      assert.equal(
        (
          await pg.query(
            `SELECT 1 FROM ${table} WHERE ${table === 'record_version' ? 'record_id' : 'id'} = $1`,
            [tasked],
          )
        ).rows.length,
        1,
        table,
      )
    }
  } finally {
    await testDb.close()
  }
})

test('확정한 부서 기록은 쓰인 적 없어도 없애지 않는다(physical-model.md: 확정한 기록은 지우지 않는다)', async () => {
  const testDb = await createTestDb()
  const { db, pg } = testDb
  try {
    const { council, create } = await setup(testDb)
    const confirmed = await create('홍보부')
    const actor = (await actorOf(db, 'u1', council.id, new Date('2026-10-19T03:00:00Z')))!
    await pg.query('UPDATE record SET confirmed_by = $1, confirmed_at = now() WHERE id = $2', [
      actor.memberId,
      confirmed,
    ])
    // 바탕에는 부서를 확정하는 길이 없어 모듈을 바로 부른다.
    await assert.rejects(
      db.transaction(tx => deleteDepartment(tx, actor, confirmed)),
      { code: 'RECORD_CONFIRMED', status: 409 },
    )
    for (const table of ['department', 'record'])
      assert.equal(
        (await pg.query(`SELECT 1 FROM ${table} WHERE id = $1`, [confirmed])).rows.length,
        1,
        table,
      )
    assert.equal(
      (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [confirmed])).rows
        .length,
      1,
    )
  } finally {
    await testDb.close()
  }
})

test('부서 편성은 회장단만 한다. 다른 학생회의 부서는 404, 형식이 틀린 본문은 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create, otherDepartment } = await setup(testDb)
    const planning = await create('기획부')
    const attempts = [
      [`${base}/departments`, { name: '홍보부' }],
      [`${base}/departments/${planning}`, { name: '기획국', role: null }],
      [`${base}/departments/${planning}/delete`, {}],
    ] as const
    for (const [path, payload] of attempts) {
      assert.equal((await api.post(path, payload, 'u2')).status, 403, path)
      assert.equal((await api.post(path, payload, 'u3')).status, 403, path)
      assert.equal((await api.post(path, payload)).status, 401, path)
    }
    assert.equal(
      (
        await api.post(
          `${base}/departments/${otherDepartment}`,
          { name: '빼앗기', role: null },
          'u1',
        )
      ).status,
      404,
    )
    assert.equal(
      (await api.post(`${base}/departments/${otherDepartment}/delete`, {}, 'u1')).status,
      404,
    )
    assert.equal((await api.post(`${base}/departments/not-a-uuid/delete`, {}, 'u1')).status, 404)
    for (const payload of [
      {},
      { name: '' },
      { name: '   ' },
      { name: '😀'.repeat(21) },
      { name: '부\u0000' },
      { name: '\uD800' },
      { name: '홍보부', extra: 1 },
    ]) {
      assert.equal(
        (await api.post(`${base}/departments`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
    for (const payload of [
      { name: '기획국' },
      { name: '기획국', role: 'leadership' },
      { name: '기획국', role: null, extra: 1 },
    ]) {
      assert.equal(
        (await api.post(`${base}/departments/${planning}`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
  } finally {
    await testDb.close()
  }
})
