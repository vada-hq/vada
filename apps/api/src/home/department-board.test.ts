import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse, PurchaseRequestsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

const now = new Date('2026-10-25T03:00:00Z')
const due = (day: string) => new Date(`${day}T23:59:59+09:00`)
function reader(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  return async (user = 's-planningHead') => {
    const response = await api.get(`/api/organizations/${t.council.councilId}/home`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as HomeResponse
  }
}

test(
  '부서장·부부장 확인할 일은 직급 부서만, 지남 중복 없이 세고 책임 행사 전부를 따로 준다',
  withSettlement(async t => {
    const read = reader(t)
    const planning = t.council.departments.planning
    for (let i = 0; i < 4; i++)
      await t.event({ name: `내 후속 ${i}`, ownerId: t.council.people.planningHead.memberId })
    await t.event({ name: '남의 후속' })
    await t.event({ name: '다른 학생회 후속' }, t.other)
    await t.make(t.council, 'task', {
      title: '지남+미배정',
      departmentId: planning,
      dueAt: due('2026-10-24'),
    })
    await t.make(t.council, 'task', { title: '미배정', departmentId: planning })
    await t.make(t.council, 'task', {
      title: '다른 부서',
      departmentId: t.council.departments.finance,
      dueAt: due('2026-10-23'),
    })
    const home = await read()
    assert.equal(home.kind, 'department')
    assert.equal(home.departmentBoard?.ownedEnded.length, 4)
    assert.equal(home.departmentBoard?.attention.total, 2)
    assert.deepEqual(
      home.departmentBoard?.attention.items.map(row => [row.task.title, row.reason]),
      [
        ['지남+미배정', 'overdue'],
        ['미배정', 'unassigned'],
      ],
    )
    assert.equal((await read('s-planningViceHead')).departmentBoard?.attention.total, 2)
    for (const user of ['s-president', 's-financeMember', 's-planningMember'])
      assert.equal((await read(user)).departmentBoard, undefined)
  }),
)

test(
  '부서 구매는 현재 부서원과 내 요청만, 취소·결제 완료 제외, 반려 먼저 필요한 때 순이다',
  withSettlement(async t => {
    const read = reader(t)
    const own = await t.requestWithItem(null, {
      title: '내 요청',
      requestedBy: t.council.people.planningHead.memberId,
      neededBy: '2026-10-27',
    })
    const pending = await t.requestWithItem(null, { title: '기획 요청', neededBy: '2026-10-26' })
    const rejected = await t.requestWithItem(null, { title: '반려', neededBy: '2026-11-01' })
    await t.approve(rejected.line, 'rejected')
    const paid = await t.requestWithItem(null, { title: '결제 완료' })
    await t.approve(paid.line)
    await t.pay(await t.expense(), paid.line)
    const cancelled = await t.requestWithItem(null, { title: '취소' })
    await t.pg.query('UPDATE request SET cancelled_at = now() WHERE id = $1', [cancelled.request])
    await t.requestWithItem(null, {
      title: '재정부 요청',
      requestedBy: t.council.people.financeMember.memberId,
    })
    await t.requestWithItem(null, { title: '다른 학생회 요청' }, t.other)
    assert.deepEqual(
      (await read()).departmentBoard?.purchases.requests.map(row => row.id),
      [rejected.request, pending.request, own.request],
    )
    const response = await t.api.get(
      `/api/organizations/${t.council.councilId}/purchase-requests?view=department`,
      's-planningHead',
    )
    assert.equal(response.status, 200)
    assert.deepEqual(
      ((await response.json()) as PurchaseRequestsResponse).requests.map(row => row.id),
      [rejected.request, pending.request, own.request],
    )
    await t.pg.query('UPDATE department_membership SET ends_at = now() WHERE member_id = $1', [
      t.council.people.planningMember.memberId,
    ])
    assert.deepEqual(
      (await read()).departmentBoard?.purchases.requests.map(row => row.id),
      [own.request],
    )
  }),
)

test(
  '직급 부서 둘은 합치고 일반 소속·떠난 부서원·학생회 탈퇴자는 구매에서 제외한다',
  withSettlement(async t => {
    const read = reader(t)
    const owner = t.council.people.planningHead.memberId
    const departmentId = await t.make(t.council, 'department', { name: '소통부' })
    for (const [memberId, departmentRank] of [
      [owner, 'vice_head'],
      [t.council.people.plain.memberId, null],
    ] as const) {
      await t.make(t.council, 'department_membership', {
        memberId,
        departmentId,
        cohortId: t.council.cohortId,
        departmentRank,
        startsAt: now,
      })
    }
    const purchase = await t.requestWithItem(null, {
      title: '소통 요청',
      requestedBy: t.council.people.plain.memberId,
    })
    await t.make(t.council, 'task', { title: '소통 지남', departmentId, dueAt: due('2026-10-24') })
    assert.equal((await read()).departmentBoard?.departments.length, 2)
    assert.equal((await read()).departmentBoard?.attention.total, 1)
    assert.equal((await read()).departmentBoard?.purchases.requests[0]?.id, purchase.request)
    await t.pg.query('UPDATE council_membership SET ends_at = now() WHERE member_id = $1', [
      t.council.people.plain.memberId,
    ])
    assert.equal((await read()).departmentBoard?.purchases.total, 0)
    await t.pg.query(
      'UPDATE department_membership SET ends_at = now() WHERE member_id = $1 AND department_id = $2',
      [owner, departmentId],
    )
    assert.equal((await read()).departmentBoard?.departments.length, 1)
    assert.equal((await read()).departmentBoard?.attention.total, 0)
  }),
)

test(
  '마감 몰림은 오늘부터 7일째까지 현재 부서원에게 맡긴 열린 업무 3건부터이며 이탈 시 빠진다',
  withSettlement(async t => {
    const read = reader(t)
    const assigneeId = t.council.people.planningMember.memberId
    const departmentId = t.council.departments.planning
    const make = (title: string, day: string) =>
      t.make(t.council, 'task', { title, departmentId, assigneeId, dueAt: due(day) })
    await make('오늘', '2026-10-25')
    await make('경계', '2026-11-01')
    await make('지난 것', '2026-10-24')
    await make('경계 밖', '2026-11-02')
    assert.equal((await read()).departmentBoard?.congestion, null)
    await make('가운데', '2026-10-28')
    assert.deepEqual((await read()).departmentBoard?.congestion, {
      member: { id: assigneeId, name: 's planningMember' },
      departmentIds: [departmentId],
      count: 3,
      firstDue: '2026-10-25',
      lastDue: '2026-11-01',
    })
    await t.pg.query('UPDATE council_membership SET ends_at = now() WHERE member_id = $1', [
      assigneeId,
    ])
    assert.equal((await read()).departmentBoard?.congestion, null)
  }),
)
