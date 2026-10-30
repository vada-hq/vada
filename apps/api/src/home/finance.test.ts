import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HOME_ENDED_LIMIT,
  HOME_LIST_LIMIT,
  type HomeResponse,
  type PurchaseRequestsResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createPurchaseRoutes } from '../purchases/routes.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { clockNow, updateRecord } from '../records/records.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

const now = new Date('2026-10-25T03:00:00Z')

function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      purchases: createPurchaseRoutes(t.db, testSession, { clock: () => now }),
      settlement: createSettlementRoutes(t.db, testSession, { clock: () => now }),
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const councilBase = `/api/organizations/${t.council.councilId}`
  const read = async (user: string) => {
    const response = await api.get(`${councilBase}/home`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as HomeResponse
  }
  const pendingScreen = async () =>
    (
      (await (
        await api.get(`${councilBase}/purchase-requests?view=pending`, 's-financeMember')
      ).json()) as PurchaseRequestsResponse
    ).requests
  return { api, read, pendingScreen, councilBase }
}

test('결재 대기 품목 수는 처리 단계의 검토 대기처럼 대기 요청에서 아직 결재하지 않은 품목만 센다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const two = await t.requestWithItem(null, { title: '품목 둘' })
    await t.make(t.council, 'line_item', { requestId: two.request, name: '둘째', quantity: 1 })
    const partial = await t.requestWithItem(null, { title: '일부 승인' })
    await t.approve(partial.line)
    await t.make(t.council, 'line_item', { requestId: partial.request, name: '남음', quantity: 1 })
    const decided = await t.requestWithItem(null, { title: '결재 끝' })
    await t.approve(decided.line)
    await t.requestWithItem(null, { title: '남의 학생회' }, t.other)
    const { received } = await h.read('s-financeMember')
    assert.equal(received!.total, 2)
    assert.equal(received!.pendingItems, 3)
    const pending = (await h.pendingScreen()).flatMap(row => row.itemBriefs ?? [])
    assert.equal(pending.filter(item => item.status === 'pending').length, 3)
  })()
})

test('재정부는 결재 대기 요청을 재정 화면과 같은 순서로 받고 취소·결재 끝난 요청과 다른 학생회 요청은 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const first = await t.requestWithItem(null, { title: '먼저' })
    await t.requestWithItem(null, { title: '나중' })
    // 한 품목만 결재한 요청은 아직 대기다.
    const partial = await t.requestWithItem(null, { title: '일부 승인' })
    await t.approve(partial.line)
    await t.make(t.council, 'line_item', { requestId: partial.request, name: '둘째', quantity: 1 })
    const decided = await t.requestWithItem(null, { title: '결재 끝' })
    await t.approve(decided.line)
    const cancelled = await t.requestWithItem(null, { title: '취소' })
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'request',
        id: cancelled.request,
        actor: t.council.people.planningMember.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
    await t.requestWithItem(null, { title: '남의 학생회' }, t.other)
    const home = await h.read('s-financeMember')
    assert.deepEqual(
      home.received!.requests.map(row => row.title),
      ['먼저', '나중', '일부 승인'],
    )
    assert.equal(home.received!.total, 3)
    assert.equal(home.received!.truncated, false)
    assert.deepEqual(
      home.received!.requests.map(row => row.id),
      (await h.pendingScreen()).map(row => row.id),
    )
    // 결재하면 다음 읽기에서 빠진다.
    await t.approve(first.line)
    assert.deepEqual(
      (await h.read('s-financeMember')).received!.requests.map(row => row.title),
      ['나중', '일부 승인'],
    )
  })()
})

test('받은 것은 10줄까지 주고 전체 수를 센다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let index = 0; index < HOME_LIST_LIMIT + 2; index++)
      await t.requestWithItem(null, { title: `요청 ${index}` })
    const { received } = await h.read('s-financeMember')
    assert.equal(received!.requests.length, HOME_LIST_LIMIT)
    assert.equal(received!.total, HOME_LIST_LIMIT + 2)
    assert.equal(received!.requests[0]?.title, '요청 0')
  })()
})

test('재정이 아닌 부원과 부장은 받은 것도 정산할 행사도 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await t.requestWithItem(null, { title: '대기' })
    await t.event({ name: '끝남' })
    for (const user of ['s-planningMember', 's-planningHead']) {
      const home = await h.read(user)
      assert.equal(home.received, undefined, user)
      assert.equal(home.settling, undefined, user)
    }
  })()
})

test('다른 학생회의 재정부는 이 학생회 홈을 읽지 못한다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    assert.equal((await h.api.get(`${h.councilBase}/home`, 'o-financeMember')).status, 403)
  })()
})

test('재정이고 회장단이 아니면 끝났고 완료하지 않은 행사와 남은 것 수를 받는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ended = await t.event({ name: '끝남' })
    await t.event({ name: '깨끗', startsAt: new Date('2026-10-21T00:00:00Z') })
    const done = await t.event({ name: '완료함', startsAt: new Date('2026-10-01T00:00:00Z') })
    await t.completion(done, 'completed', now)
    await t.event({
      name: '진행',
      startsAt: new Date('2026-10-25T00:00:00Z'),
      endsAt: new Date('2026-10-26T00:00:00Z'),
    })
    await t.event({ name: '남의 행사' }, t.other)
    await t.requestWithItem(ended, { title: '대기' })
    await t.expense({ eventId: ended, reason: null })
    const home = await h.read('s-financeMember')
    const tab = await t.settlement(ended)
    const total = tab.remaining.reduce((sum, item) => sum + item.count, 0)
    assert.ok(total > 0)
    assert.deepEqual(
      home.settling!.events.map(row => [row.event.name, row.settlement]),
      [
        ['끝남', { remaining: total, settled: false }],
        ['깨끗', { remaining: 0, settled: true }],
      ],
    )
    assert.equal(home.settling!.total, 2)
  })()
})

test('정산할 행사는 끝난 지 오래된 것부터 10개까지이고 전체 수가 따로 온다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let day = 1; day <= HOME_ENDED_LIMIT + 2; day++)
      await t.event({
        name: `끝남 ${day}`,
        startsAt: new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00Z`),
      })
    const { settling } = await h.read('s-financeMember')
    assert.equal(settling!.events.length, HOME_ENDED_LIMIT)
    assert.equal(settling!.total, HOME_ENDED_LIMIT + 2)
    assert.equal(settling!.events[0]?.event.name, '끝남 1')
  })()
})

test('회장단이면서 재정이면 받은 것은 받고 정산할 행사는 회장단 홈 후속 정리로만 본다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { vicePresident } = t.council.people
    await t.make(t.council, 'department_membership', {
      memberId: vicePresident.memberId,
      departmentId: t.council.departments.finance,
      cohortId: t.council.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    await t.requestWithItem(null, { title: '대기' })
    await t.event({ name: '끝남' })
    const home = await h.read('s-vicePresident')
    assert.equal(home.received?.total, 1)
    assert.equal(home.settling, undefined)
    assert.equal(home.councilBoard?.followUp.total, 1)
    // 재정이 아닌 회장단은 받은 것이 없다.
    assert.equal((await h.read('s-president')).received, undefined)
  })()
})

// 필요한 때 순(DEC-92): 가까운 것 → 먼 것 → 필요한 때 없는 것은 오래된 순. 홈은 재정 결재 대기를 그대로 자른다.
test('받은 것은 재정 결재 대기와 같은 필요한 때 순이고 다른 학생회 요청은 섞이지 않는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await t.requestWithItem(null, { title: '없음 오래됨' })
    await t.requestWithItem(null, { title: '10일 뒤', neededBy: '2026-11-04' })
    await t.requestWithItem(null, { title: '2일 뒤', neededBy: '2026-10-27' })
    await t.requestWithItem(null, { title: '없음 새것' })
    await t.requestWithItem(null, { title: '남의 학생회', neededBy: '2026-10-26' }, t.other)
    const order = ['2일 뒤', '10일 뒤', '없음 오래됨', '없음 새것']
    const home = await h.read('s-financeMember')
    assert.deepEqual(
      home.received!.requests.map(row => row.title),
      order,
    )
    assert.deepEqual(
      (await h.pendingScreen()).map(row => row.title),
      order,
    )
  })()
})

test('필요한 때가 가장 가까운 요청은 가장 늦게 냈어도 받은 것 10줄의 맨 앞이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let index = 0; index < HOME_LIST_LIMIT + 1; index++)
      await t.requestWithItem(null, { title: `요청 ${index}` })
    await t.requestWithItem(null, { title: '급함', neededBy: '2026-10-26' })
    const { received } = await h.read('s-financeMember')
    assert.equal(received!.requests.length, HOME_LIST_LIMIT)
    assert.equal(received!.total, HOME_LIST_LIMIT + 2)
    assert.equal(received!.requests[0]?.title, '급함')
  })()
})
