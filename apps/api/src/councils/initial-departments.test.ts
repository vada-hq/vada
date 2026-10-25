import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createCouncilRoutes } from './routes.js'

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
    }),
  )
}

const departmentsOf = async (testDb: TestDb, councilId: string) =>
  (
    await testDb.pg.query<{ name: string; role: string | null }>(
      'SELECT name, role FROM department WHERE council_id = $1 ORDER BY name',
      [councilId],
    )
  ).rows

test('처음 부서 목록: 같은 거래에 재정 역할 부서 하나와 역할 없는 부서들이 생기고, 각각 판 1과 만든 사람이 있다. 부서방은 생기지 않는다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'u1')
    const response = await appOf(testDb).post(
      '/api/organizations/create',
      { ...body, financeDepartmentName: ' 총무부 ', departments: ['기획부', '홍보부 '] },
      'u1',
    )
    assert.equal(response.status, 201)
    const { council } = (await response.json()) as CreateCouncilResponse
    assert.deepEqual(await departmentsOf(testDb, council.id), [
      { name: '기획부', role: null },
      { name: '총무부', role: 'finance' },
      { name: '홍보부', role: null },
    ])
    const versions = await pg.query<{ version_no: number; self: boolean }>(
      `SELECT v.version_no, r.created_by = ml.member_id AS self FROM department d
       JOIN record r ON r.id = d.id JOIN record_version v ON v.record_id = d.id
       JOIN member_login ml ON ml.user_id = 'u1' WHERE d.council_id = $1`,
      [council.id],
    )
    assert.deepEqual(
      versions.rows,
      Array.from({ length: 3 }, () => ({ version_no: 1, self: true })),
    )
    // 대화방은 학생회를 만들 때와 같은 둘(전체방, 회장단방)뿐이다(RULE-28: 부서방은 운영진이 있는 부서마다).
    const rooms = await pg.query<{ department_id: string | null }>(
      'SELECT c.department_id FROM chat_room c JOIN record r ON r.id = c.id WHERE r.council_id = $1',
      [council.id],
    )
    assert.deepEqual(rooms.rows, [{ department_id: null }, { department_id: null }])
  } finally {
    await testDb.close()
  }
})

test('처음 부서 목록을 빼면 재정부 하나다. 빈 목록이어도 재정 부서는 있다', async () => {
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
    const api = appOf(testDb)
    const omitted = (await (
      await api.post('/api/organizations/create', body, 'u1')
    ).json()) as CreateCouncilResponse
    assert.deepEqual(await departmentsOf(testDb, omitted.council.id), [
      { name: '재정부', role: 'finance' },
    ])
    const empty = (await (
      await api.post('/api/organizations/create', { ...body, departments: [] }, 'u2')
    ).json()) as CreateCouncilResponse
    assert.deepEqual(await departmentsOf(testDb, empty.council.id), [
      { name: '재정부', role: 'finance' },
    ])
  } finally {
    await testDb.close()
  }
})

test('처음 부서 목록 안의 같은 이름(재정 부서 포함), 21자, 빈 이름, 20개 넘음은 400이고 아무것도 남지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    const twenty = Array.from({ length: 20 }, (_, index) => `부서${index}`)
    for (const bad of [
      { ...body, departments: ['기획부', '기획부'] },
      { ...body, departments: ['기획부', ' 기획부'] },
      { ...body, departments: ['재정부'] },
      { ...body, financeDepartmentName: '기획부', departments: ['기획부'] },
      { ...body, departments: ['😀'.repeat(21)] },
      { ...body, financeDepartmentName: 'a'.repeat(21) },
      { ...body, departments: [''] },
      { ...body, departments: ['   '] },
      { ...body, financeDepartmentName: '' },
      { ...body, departments: twenty },
    ]) {
      const response = await api.post('/api/organizations/create', bad, 'u1')
      assert.equal(response.status, 400, JSON.stringify(bad))
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    for (const table of ['record', 'member', 'council', 'cohort', 'department'])
      assert.equal((await testDb.pg.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table)
  } finally {
    await testDb.close()
  }
})
