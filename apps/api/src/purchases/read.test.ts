import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  PurchaseRequestDetail,
  PurchaseRequestsResponse,
  PurchaseStatus,
} from '@vada/contracts'
import { createRecord } from '../records/records.js'
import {
  detailOf,
  errorOf,
  ITEM,
  MISSING,
  runPurchases,
  startPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

const list = async (s: PurchaseKit, query: string, user = 's-president') => {
  const response = await s.api.get(`${s.base}?${query}`, user)
  assert.equal(response.status, 200, query)
  return (await response.json()) as PurchaseRequestsResponse
}
const titles = async (s: PurchaseKit, query: string, user = 's-president') =>
  (await list(s, query, user)).requests.map(request => request.title)
const read = async (s: PurchaseKit, id: string, user = 's-president') =>
  detailOf(await s.api.get(`${s.base}/${id}`, user))
const two = { title: '둘', items: [ITEM, { name: '자석', quantity: 2 }] }

test(
  '목록 거르기: 내 요청과 전체는 최근 순, 결재 대기는 오래된 순이고 취소된 요청은 대기에서 빠진다',
  runPurchases(async s => {
    const a = await s.made({ title: 'A', items: [ITEM] }, 's-planningMember')
    await s.made({ title: 'B', items: [ITEM] }, 's-plain')
    const c = await s.made({ title: 'C', items: [ITEM] }, 's-planningMember')
    const d = await s.made({ title: 'D', items: [ITEM] }, 's-plain')
    await s.api.post(`${s.base}/${c.id}/cancel`, {}, 's-planningMember')
    await s.decide(a.items[0]!.id, 'approved')
    assert.deepEqual(await titles(s, 'view=all'), ['D', 'C', 'B', 'A'])
    assert.deepEqual(await titles(s, 'view=mine', 's-planningMember'), ['C', 'A'])
    assert.deepEqual(await titles(s, 'view=mine', 's-plain'), ['D', 'B'])
    assert.deepEqual(await titles(s, 'view=pending', 's-financeMember'), ['B', 'D'])
    const row = (await list(s, 'view=all')).requests.find(request => request.id === d.id)!
    assert.deepEqual(
      { ...row, createdAt: undefined },
      {
        id: d.id,
        title: 'D',
        status: 'pending',
        requestedBy: { id: s.council.people.plain.memberId, name: 's plain' },
        neededBy: null,
        itemCount: 1,
        createdAt: undefined,
      },
    )
  }),
)

test(
  '요청 상태는 센다: 대기, 승인, 반려, 일부 승인, 취소',
  runPurchases(async s => {
    const made = async (title: string) => s.made({ ...two, title })
    const pending = await made('대기')
    const half = await made('반쪽')
    await s.decide(half.items[0]!.id, 'approved')
    const approved = await made('승인')
    for (const item of approved.items) await s.decide(item.id, 'approved')
    const rejected = await made('반려')
    for (const item of rejected.items) await s.decide(item.id, 'rejected')
    const mixed = await made('섞임')
    await s.decide(mixed.items[0]!.id, 'approved')
    await s.decide(mixed.items[1]!.id, 'rejected')
    const cancelled = await made('취소')
    await s.api.post(`${s.base}/${cancelled.id}/cancel`, {}, 's-planningMember')
    const statuses = Object.fromEntries(
      (await list(s, 'view=all')).requests.map(request => [request.title, request.status]),
    ) as Record<string, PurchaseStatus>
    assert.deepEqual(statuses, {
      대기: 'pending',
      반쪽: 'pending',
      승인: 'approved',
      반려: 'rejected',
      섞임: 'partial',
      취소: 'cancelled',
    })
    // 반쪽은 아직 대기에 있고 결재가 끝난 요청은 대기에서 빠진다.
    assert.deepEqual((await titles(s, 'view=pending')).sort(), ['대기', '반쪽'].sort())
    assert.equal((await read(s, pending.id)).status, 'pending')
  }),
)

test('결재 대기는 300개, 내 요청과 전체는 100개까지 주고 넘치면 truncated이다', async () => {
  const s = await startPurchases()
  try {
    const insert = (n: number) =>
      s.pg.query(
        `WITH ids AS MATERIALIZED (SELECT uuidv7() AS rid, uuidv7() AS iid FROM generate_series(1, $3::int)),
         r AS (INSERT INTO record (id, kind, council_id) SELECT rid, 'request', $1::uuid FROM ids),
         i AS (INSERT INTO record (id, kind, council_id) SELECT iid, 'line_item', $1::uuid FROM ids)
         , q AS (INSERT INTO request (id, type, title, requested_by) SELECT rid, 'purchase', 't', $2::uuid FROM ids)
         INSERT INTO line_item (id, request_id, name, quantity) SELECT iid, rid, 'n', 1 FROM ids`,
        [s.council.councilId, s.council.people.plain.memberId, n],
      )
    await insert(301)
    const pending = await list(s, 'view=pending')
    assert.equal(pending.requests.length, 300)
    assert.equal(pending.truncated, true)
    const all = await list(s, 'view=all')
    assert.equal(all.requests.length, 100)
    assert.equal(all.truncated, true)
    assert.equal((await list(s, 'view=mine', 's-plain')).requests.length, 100)
    assert.equal((await list(s, 'view=mine', 's-president')).truncated, false)
  } finally {
    await s.close()
  }
})

test(
  '요청 하나는 품목, 결재 기록, 결제한 지출, 이력, 그 사람의 동작을 준다',
  runPurchases(async s => {
    const request = await s.made(
      {
        title: '마커',
        body: '회의용',
        items: [
          { name: '마커', quantity: 3, link: 'https://shop.example/m', options: '검정' },
          { name: '자석', quantity: 2 },
          { name: '테이프', quantity: 1 },
        ],
      },
      's-planningMember',
    )
    const [marker, magnet] = request.items
    const council = s.council
    const budgetId = await s.db.transaction(async tx => {
      const periodId = await createRecord(tx, {
        kind: 'fiscal_period',
        councilId: council.councilId,
        actor: council.people.financeMember.memberId,
        values: { name: '2학기', startsOn: '2026-07-01', endsOn: '2026-12-31' },
      })
      const budget = await createRecord(tx, {
        kind: 'budget',
        councilId: council.councilId,
        actor: council.people.financeMember.memberId,
        values: { fiscalPeriodId: periodId },
      })
      return createRecord(tx, {
        kind: 'budget_item',
        councilId: council.councilId,
        actor: council.people.financeMember.memberId,
        values: { budgetId: budget, type: 'expense', purpose: '소모품', amount: '100000' },
      })
    })
    await s.pg.query('UPDATE line_item SET amount = 30000, budget_item_id = $2 WHERE id = $1', [
      marker!.id,
      budgetId,
    ])
    await s.decide(marker!.id, 'approved')
    await s.decide(magnet!.id, 'rejected')
    const expenseId = await s.db.transaction(async tx => {
      const expense = await createRecord(tx, {
        kind: 'expense',
        councilId: council.councilId,
        actor: council.people.financeMember.memberId,
        values: {
          amount: '30000',
          paidAt: new Date('2026-10-24T03:00:00Z'),
          description: '마커',
          vendor: '문구점',
          method: 'card',
        },
      })
      await createRecord(tx, {
        kind: 'payment_line',
        councilId: council.councilId,
        actor: council.people.financeMember.memberId,
        values: { expenseId: expense, lineItemId: marker!.id, amount: '30000' },
      })
      return expense
    })
    const detail: PurchaseRequestDetail = await read(s, request.id, 's-plain')
    assert.equal(detail.body, '회의용')
    assert.equal(detail.status, 'pending')
    assert.deepEqual(
      detail.items.map(item => [item.name, item.status, item.amount, item.paid]),
      [
        ['마커', 'approved', 30000, true],
        ['자석', 'rejected', null, false],
        ['테이프', 'pending', null, false],
      ],
    )
    assert.deepEqual(detail.items[0]!.budgetItem, { id: budgetId, purpose: '소모품' })
    assert.equal(detail.items[0]!.link, 'https://shop.example/m')
    assert.deepEqual(
      detail.decisions.map(item => [item.lineItemId, item.outcome, item.by?.name, item.reason]),
      [
        [marker!.id, 'approved', 's financeMember', null],
        [magnet!.id, 'rejected', 's financeMember', '비싸요'],
      ],
    )
    assert.deepEqual(
      detail.expenses.map(item => [item.id, item.vendor, item.amount, item.cancelled]),
      [[expenseId, '문구점', 30000, false]],
    )
    assert.equal(detail.history.length, 1)
    assert.equal(detail.history[0]!.by?.name, 's planningMember')
    // 동작: 요청한 사람은 결재가 시작돼 취소가 닫혔고, 재정부는 결재할 수 있다. 다른 사람은 없다.
    assert.deepEqual(detail.actions, [])
    assert.deepEqual((await read(s, request.id, 's-planningMember')).actions, [])
    assert.deepEqual((await read(s, request.id, 's-financeMember')).actions, ['purchase.approve'])
    // 취소된 지출은 '결제함'이 아니다.
    await s.pg.query('UPDATE expense SET cancelled_at = now() WHERE id = $1', [expenseId])
    const after = await read(s, request.id, 's-plain')
    assert.equal(after.items[0]!.paid, false)
    assert.equal(after.expenses[0]!.cancelled, true)
  }),
)

test(
  '동작: 결재 전에는 요청한 사람이 취소하고 재정부가 결재하며, 재정부가 낸 요청은 둘 다 한다',
  runPurchases(async s => {
    const mine = await s.made({ ...two, title: '내 것' }, 's-planningMember')
    assert.deepEqual(mine.actions, ['purchase.cancel'])
    assert.deepEqual((await read(s, mine.id, 's-financeMember')).actions, ['purchase.approve'])
    assert.deepEqual((await read(s, mine.id, 's-president')).actions, [])
    const own = await s.made({ ...two, title: '재정부 것' }, 's-financeMember')
    assert.deepEqual(own.actions, ['purchase.cancel', 'purchase.approve'])
  }),
)

test(
  '읽기 실패: 운영진이 아니면 403, 로그인하지 않으면 401, 다른 학생회와 틀린 번호는 404이고 거르기가 틀리면 400이다',
  runPurchases(async s => {
    const request = await s.made()
    for (const user of ['o-president', 's-ended'])
      for (const path of [`${s.base}?view=all`, `${s.base}/${request.id}`])
        assert.equal((await s.api.get(path, user)).status, 403, `${user} ${path}`)
    assert.equal((await s.api.get(`${s.base}?view=all`)).status, 401)
    assert.equal((await s.api.get(`${s.base}/${request.id}`)).status, 401)
    for (const id of [MISSING, 'not-a-uuid'])
      assert.equal((await s.api.get(`${s.base}/${id}`, 's-president')).status, 404, id)
    const foreign = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: 'x', items: [ITEM] },
      'o-plain',
    )
    const theirs = (await detailOf(foreign)).id
    const missing = await s.api.get(`${s.base}/${theirs}`, 's-president')
    assert.equal(missing.status, 404)
    assert.equal(await errorOf(missing), 'NOT_FOUND')
    assert.deepEqual(await titles(s, 'view=all'), ['마커'])
    for (const query of ['', 'view=other', 'view=all&view=mine', 'view=all&x=1', 'view=ALL'])
      assert.equal((await s.api.get(`${s.base}?${query}`, 's-president')).status, 400, query)
  }),
)

test(
  'JSON 응답은 no-store이다',
  runPurchases(async s => {
    const request = await s.made()
    for (const path of [`${s.base}?view=all`, `${s.base}/${request.id}`])
      assert.equal((await s.api.get(path, 's-president')).headers.get('cache-control'), 'no-store')
  }),
)
