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

// 쓴 부서 그만 쓰기(기능 023 조각 7, DEC-91, 정한 것 8).
const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}

// 회장 u1의 학생회에 u2(기획부 국장), u4(기획부와 홍보부)가 있다. u3은 다른 학생회의 회장이고 그 학생회에도 같은 이름의 기획부가 있다.
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
  for (const user of ['u1', 'u2', 'u3', 'u4'])
    await addUser(testDb.pg, user, { name: `이름 ${user}` })
  const make = async (user: string, name: string) =>
    (
      (await (
        await api.post('/api/organizations/create', { ...body, name }, user)
      ).json()) as CreateCouncilResponse
    ).council
  const council = await make('u1', '컴퓨터학부 학생회')
  const other = await make('u3', '경영학부 학생회')
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, 'u1')
  ).json()) as InviteCodeResponse
  for (const user of ['u2', 'u4']) await api.post('/api/organizations/join', { code }, user)
  const base = `/api/organizations/${council.id}`
  const otherBase = `/api/organizations/${other.id}`
  const create = async (path: string, user: string, name: string) =>
    (
      (await (await api.post(`${path}/departments`, { name }, user)).json()) as TeamResponse
    ).departments.find(item => item.name === name)!.id
  const planning = await create(base, 'u1', '기획부')
  const promo = await create(base, 'u1', '홍보부')
  const otherPlanning = await create(otherBase, 'u3', '기획부')
  const team = (await (await api.get(`${base}/members`, 'u1')).json()) as TeamResponse
  const id = (user: string) => team.members.find(item => item.name === `이름 ${user}`)!.id
  const assign = async (memberId: string, departmentId: string, rank: string | null) =>
    assert.equal(
      (await api.post(`${base}/members/${memberId}/departments`, { departmentId, rank }, 'u1'))
        .status,
      200,
    )
  await assign(id('u2'), planning, 'head')
  await assign(id('u4'), planning, null)
  await assign(id('u4'), promo, null)
  return {
    api,
    base,
    finance: team.departments.find(item => item.role === 'finance')!.id,
    planning,
    promo,
    otherPlanning,
    otherBase,
    member: { u1: id('u1'), u2: id('u2'), u4: id('u4') },
  }
}

const openPlacements = async (testDb: TestDb, departmentId: string) =>
  (
    await testDb.pg.query(
      'SELECT member_id FROM department_membership WHERE department_id = $1 AND ends_at IS NULL',
      [departmentId],
    )
  ).rows.length
const roomMembers = async (testDb: TestDb, departmentId: string) =>
  (
    await testDb.pg.query(
      `SELECT rm.member_id FROM room_membership rm JOIN chat_room cr ON cr.id = rm.room_id
       WHERE cr.type = 'department' AND cr.department_id = $1`,
      [departmentId],
    )
  ).rows.length
const versions = async (testDb: TestDb, recordId: string) =>
  (await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [recordId])).rows
    .length

test('그만 쓰면 목록에서 빠지고, 남은 소속이 같은 거래에서 끝나며 부서방 참여도 비고 판이 하나 는다. 기록은 남는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, planning, promo, member } = await setup(testDb)
    assert.equal(await roomMembers(testDb, planning), 2)
    const before = await versions(testDb, planning)
    const response = await api.post(`${base}/departments/${planning}/retire`, {}, 'u1')
    assert.equal(response.status, 200)
    const team = (await response.json()) as TeamResponse
    assert.deepEqual(
      team.departments.map(item => item.name),
      ['재정부', '홍보부'],
    )
    // 그 부서만 있던 u2는 미배정이 되고, 두 부서에 든 u4는 홍보부에 남는다.
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [])
    assert.deepEqual(team.members.find(item => item.id === member.u4)!.departments, [
      { id: promo, rank: null },
    ])
    assert.equal(await openPlacements(testDb, planning), 0)
    assert.equal(await roomMembers(testDb, planning), 0)
    assert.equal(await versions(testDb, planning), before + 1)
    const [row] = (
      await testDb.pg.query<{ retired: boolean; name: string }>(
        'SELECT retired_at IS NOT NULL AS retired, name FROM department WHERE id = $1',
        [planning],
      )
    ).rows
    assert.deepEqual(row, { retired: true, name: '기획부' })
    // 끝난 소속 기록은 지우지 않는다.
    assert.equal(
      (
        await testDb.pg.query('SELECT 1 FROM department_membership WHERE department_id = $1', [
          planning,
        ])
      ).rows.length,
      2,
    )
  } finally {
    await testDb.close()
  }
})

test('목록의 부서마다 쓰인 적이 있는지(used)를 보낸다. 빠졌다 끝난 소속도 쓰인 것이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, finance, promo, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u4}/departments/${promo}/remove`, {}, 'u1')
    const team = (await (await api.get(`${base}/members`, 'u1')).json()) as TeamResponse
    assert.deepEqual(
      team.departments.map(item => [item.name, item.memberCount, item.used]),
      [
        ['재정부', 0, false],
        ['기획부', 2, true],
        ['홍보부', 0, true],
      ],
    )
    assert.ok(finance)
  } finally {
    await testDb.close()
  }
})

test('재정 역할이 있는 부서는 409 DEPARTMENT_HAS_ROLE이고 아무것도 바뀌지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, finance, member } = await setup(testDb)
    await api.post(
      `${base}/members/${member.u2}/departments`,
      { departmentId: finance, rank: null },
      'u1',
    )
    const before = await versions(testDb, finance)
    const response = await api.post(`${base}/departments/${finance}/retire`, {}, 'u1')
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'DEPARTMENT_HAS_ROLE' })
    assert.equal(await openPlacements(testDb, finance), 1)
    assert.equal(await versions(testDb, finance), before)
  } finally {
    await testDb.close()
  }
})

test('그만 쓴 부서와 같은 이름으로 만들거나 바꾸면 409, 그만 쓴 부서로 배정·옮기기·고치기·다시 그만 쓰기는 404다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, planning, promo, member } = await setup(testDb)
    assert.equal((await api.post(`${base}/departments/${planning}/retire`, {}, 'u1')).status, 200)
    const cases: [string, () => ReturnType<typeof api.post>, number][] = [
      ['같은 이름 만들기', () => api.post(`${base}/departments`, { name: '기획부' }, 'u1'), 409],
      [
        '같은 이름으로 바꾸기',
        () => api.post(`${base}/departments/${promo}`, { name: '기획부', role: null }, 'u1'),
        409,
      ],
      [
        '배정',
        () =>
          api.post(
            `${base}/members/${member.u2}/departments`,
            { departmentId: planning, rank: null },
            'u1',
          ),
        404,
      ],
      [
        '옮기기',
        () =>
          api.post(
            `${base}/members/${member.u4}/departments/move`,
            { fromDepartmentId: promo, toDepartmentId: planning, rank: null },
            'u1',
          ),
        404,
      ],
      [
        '고치기',
        () => api.post(`${base}/departments/${planning}`, { name: '기획국', role: null }, 'u1'),
        404,
      ],
      ['다시 그만 쓰기', () => api.post(`${base}/departments/${planning}/retire`, {}, 'u1'), 404],
      ['없애기', () => api.post(`${base}/departments/${planning}/delete`, {}, 'u1'), 404],
    ]
    for (const [label, send, status] of cases) assert.equal((await send()).status, status, label)
  } finally {
    await testDb.close()
  }
})

test('그만 쓰기는 회장단만 한다. 다른 학생회의 부서는 404, 로그인 안 하면 401, 모르는 키 400이고 그 부서는 그대로다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, planning, otherPlanning, otherBase } = await setup(testDb)
    assert.equal((await api.post(`${base}/departments/${planning}/retire`, {}, 'u2')).status, 403)
    assert.equal(
      (await api.post(`${base}/departments/${otherPlanning}/retire`, {}, 'u1')).status,
      404,
    )
    assert.equal((await api.post(`${base}/departments/${planning}/retire`, {})).status, 401)
    assert.equal(
      (await api.post(`${base}/departments/${planning}/retire`, { x: 1 }, 'u1')).status,
      400,
    )
    assert.equal((await api.post(`${base}/departments/not-a-uuid/retire`, {}, 'u1')).status, 404)
    assert.equal(await openPlacements(testDb, planning), 2)
    // 다른 학생회의 같은 모양 부서도 그대로다.
    const other = (await (await api.get(`${otherBase}/members`, 'u3')).json()) as TeamResponse
    assert.ok(other.departments.some(item => item.id === otherPlanning))
  } finally {
    await testDb.close()
  }
})
