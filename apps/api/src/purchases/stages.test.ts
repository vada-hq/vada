import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PURCHASE_STAGES, purchaseStageOf, type PurchaseRequestsResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { createRecord } from '../records/records.js'
import { ITEM, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const list = async (s: PurchaseKit, query: string, user = 's-president') => {
  const response = await s.api.get(`${s.base}?${query}`, user)
  assert.equal(response.status, 200, query)
  return (await response.json()) as PurchaseRequestsResponse
}

const pay = (s: PurchaseKit, itemId: string) =>
  s.db.transaction(async tx => {
    const councilId = s.council.councilId
    const actor = s.council.people.financeMember.memberId
    const expenseId = await createRecord(tx, {
      kind: 'expense',
      councilId,
      actor,
      values: {
        amount: '1000',
        paidAt: new Date(),
        description: '구매',
        vendor: '문구점',
        method: 'card',
      },
    })
    await createRecord(tx, {
      kind: 'payment_line',
      councilId,
      actor,
      values: { expenseId, lineItemId: itemId, amount: '1000' },
    })
    return expenseId
  })

test(
  '전체 수는 100·300개 상한 밖도 세고 단계는 자르기 전에 거른다',
  runPurchases(async s => {
    const unpaid = await s.made({ title: '오래된 미결제', items: [ITEM] })
    await s.decide(unpaid.items[0]!.id, 'approved')
    await s.pg.query(
      `WITH ids AS MATERIALIZED (SELECT uuidv7() AS rid, uuidv7() AS iid FROM generate_series(1, 301)),
    r AS (INSERT INTO record (id, kind, council_id) SELECT rid, 'request', $1::uuid FROM ids),
    i AS (INSERT INTO record (id, kind, council_id) SELECT iid, 'line_item', $1::uuid FROM ids),
    q AS (INSERT INTO request (id, type, title, requested_by) SELECT rid, 'purchase', '대기', $2::uuid FROM ids)
    INSERT INTO line_item (id, request_id, name, quantity) SELECT iid, rid, '품목', 1 FROM ids`,
      [s.council.councilId, s.council.people.planningMember.memberId],
    )
    const all = await list(s, 'view=all')
    assert.equal(all.requests.length, 100)
    assert.equal(all.truncated, true)
    assert.deepEqual(all.stageCounts, { pending: 301, unpaid: 1, paid: 0, closed: 0 })
    assert.ok(all.requests.every(row => row.id !== unpaid.id))
    const filtered = await list(s, 'view=all&stage=unpaid', 's-plain')
    assert.deepEqual(
      filtered.requests.map(row => row.id),
      [unpaid.id],
    )
    assert.equal(filtered.truncated, false)
    assert.deepEqual(filtered.stageCounts, all.stageCounts)
    const pending = await list(s, 'view=pending&stage=pending')
    assert.equal(pending.requests.length, 300)
    assert.equal(pending.truncated, true)
    assert.deepEqual(pending.stageCounts, { pending: 301, unpaid: 0, paid: 0, closed: 0 })
    assert.deepEqual((await list(s, 'view=pending&stage=unpaid')).requests, [])
    const mine = await list(s, 'view=mine&stage=unpaid', 's-planningMember')
    assert.deepEqual(
      mine.requests.map(row => row.id),
      [unpaid.id],
    )
    assert.deepEqual(mine.stageCounts, all.stageCounts)
    const department = await list(s, 'view=department&event=none&stage=unpaid', 's-planningHead')
    assert.deepEqual(
      department.requests.map(row => row.id),
      [unpaid.id],
    )
    assert.deepEqual(department.stageCounts, all.stageCounts)
    assert.deepEqual((await list(s, 'view=mine')).stageCounts, {
      pending: 0,
      unpaid: 0,
      paid: 0,
      closed: 0,
    })
  }),
)

test(
  '단계 집계와 필터는 마지막 결재·부분 결제·지출 취소에서 상세와 같은 판정이다',
  runPurchases(async s => {
    const made = (title: string) => s.made({ title, items: [ITEM, ITEM] })
    const pending = await made('일부 결재')
    await s.decide(pending.items[0]!.id, 'approved')
    await pay(s, pending.items[0]!.id)
    const unpaid = await made('일부 결제')
    for (const item of unpaid.items) await s.decide(item.id, 'approved')
    await pay(s, unpaid.items[0]!.id)
    const paid = await made('승인·반려 결제함')
    await s.decide(paid.items[0]!.id, 'approved')
    await s.decide(paid.items[1]!.id, 'rejected')
    const expenseId = await pay(s, paid.items[0]!.id)
    const rejected = await made('전부 반려')
    for (const item of rejected.items) await s.decide(item.id, 'rejected')
    const cancelled = await made('요청 취소')
    await s.api.post(`${s.base}/${cancelled.id}/cancel`, {}, 's-planningMember')
    const itemCancelled = await made('승인 뒤 품목 취소')
    for (const item of itemCancelled.items) {
      await s.decide(item.id, 'approved')
      await s.decide(item.id, 'cancelled')
    }
    const all = await list(s, 'view=all')
    assert.deepEqual(all.stageCounts, { pending: 1, unpaid: 1, paid: 1, closed: 3 })
    for (const stage of PURCHASE_STAGES) {
      const filtered = await list(s, `view=all&stage=${stage}`)
      assert.deepEqual(
        filtered.requests.map(row => row.id),
        all.requests.filter(row => purchaseStageOf(row) === stage).map(row => row.id),
      )
      assert.deepEqual(filtered.stageCounts, all.stageCounts)
    }
    await s.pg.query('UPDATE expense SET cancelled_at = now() WHERE id = $1', [expenseId])
    assert.deepEqual((await list(s, 'view=all')).stageCounts, {
      pending: 1,
      unpaid: 2,
      paid: 0,
      closed: 3,
    })
    for (const query of ['stage=', 'stage=other', 'stage=PAID', 'stage=paid&stage=unpaid'])
      assert.equal(
        (await s.api.get(`${s.base}?view=all&${query}`, 's-president')).status,
        400,
        query,
      )
  }),
)

test(
  '부서 보기 권한과 조회는 같은 직급 부서를 쓰고 일반 소속으로 넓히거나 읽기를 줄이지 않는다',
  runPurchases(async s => {
    const planning = await s.made({ title: '기획부 요청', items: [ITEM] })
    await s.made({ title: '재정부 요청', items: [ITEM] }, 's-financeMember')
    await s.made({ title: '다른 사람 요청', items: [ITEM] }, 's-plain')
    for (const [user, allowed] of [
      ['s-planningHead', true],
      ['s-planningViceHead', true],
      ['s-planningMember', false],
      ['s-president', false],
      ['s-vicePresident', false],
      ['s-financeMember', false],
      ['s-plain', false],
    ] as const) {
      const actor = await actorOf(s.db, user, s.council.councilId, new Date('2026-10-25T03:00:00Z'))
      assert.ok(actor)
      assert.equal(can(actor, 'purchase.view_department'), allowed, user)
      if (allowed) {
        const department = await list(s, 'view=department&stage=pending', user)
        assert.deepEqual(
          department.requests.map(row => row.id),
          [planning.id],
          user,
        )
        assert.deepEqual(department.stageCounts, { pending: 1, unpaid: 0, paid: 0, closed: 0 })
      }
      assert.equal((await list(s, 'view=all', user)).requests.length, 3, user)
    }
  }),
)
