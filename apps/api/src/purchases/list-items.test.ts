import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseRequestsResponse } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const list = async (s: PurchaseKit, query: string, user = 's-president') => {
  const response = await s.api.get(`${s.base}?${query}`, user)
  assert.equal(response.status, 200, query)
  return (await response.json()) as PurchaseRequestsResponse
}

// 시험 DB는 연결이 하나라 송장-품목 잇기는 기록을 만든 거래가 끝난 뒤에 넣는다.
const ship = async (s: PurchaseKit, requestId: string, itemId: string) => {
  const councilId = s.council.councilId
  const id = await s.db.transaction(tx =>
    createRecord(tx, {
      kind: 'shipment',
      councilId,
      actor: s.council.people.financeMember.memberId,
      values: { requestId, carrierId: 'kr.coupangls', trackingNumber: '123-456' },
    }),
  )
  await s.pg.query(
    'INSERT INTO shipment_item (shipment_id,line_item_id,council_id) VALUES ($1,$2,$3)',
    [id, itemId, councilId],
  )
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
  })

test(
  '목록은 요청마다 품목 요약(상태·예상 가격·결제·송장)과 요청한 사람의 지금 부서를 준다',
  runPurchases(async s => {
    const made = await s.made({
      title: '체육대회 물품',
      items: [
        { name: '생수', quantity: 10, estimatedUnitPrice: 500, estimatedShippingFee: 3000 },
        { name: '테이프', quantity: 2 },
        { name: '현수막', quantity: 1, estimatedUnitPrice: 50000 },
        { name: '조끼', quantity: 5 },
      ],
    })
    const [water, tape, banner, vest] = made.items.map(item => item.id)
    await s.decide(water!, 'approved')
    await s.decide(tape!, 'approved')
    await s.decide(banner!, 'rejected')
    await pay(s, water!)
    await ship(s, made.id, tape!)
    const [row] = (await list(s, 'view=all')).requests
    assert.deepEqual(
      row?.itemBriefs?.map(item => [
        item.name,
        item.status,
        item.estimate,
        item.paid,
        item.shipped,
      ]),
      [
        ['생수', 'approved', 8000, true, false],
        ['테이프', 'approved', null, false, true],
        ['현수막', 'rejected', 50000, false, false],
        ['조끼', 'pending', null, false, false],
      ],
    )
    assert.equal(row?.itemBriefs?.find(item => item.id === vest)?.amount, null)
    const departments = (
      await s.pg.query(
        `SELECT d.name FROM department_membership m JOIN department d ON d.id = m.department_id
         WHERE m.member_id = $1 AND m.ends_at IS NULL`,
        [s.council.people.planningMember.memberId],
      )
    ).rows.map(r => (r as { name: string }).name)
    assert.ok(departments.length > 0)
    assert.deepEqual(row?.requesterDepartments, departments)
  }),
)

test(
  '다른 학생회 요청의 품목은 목록에 섞이지 않는다',
  runPurchases(async s => {
    await s.made({ title: '우리 것', items: [{ name: '마커', quantity: 1 }] })
    const theirs = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: '다른 학생회', items: [{ name: '남의 물품', quantity: 1 }] },
      'o-plain',
    )
    assert.equal(theirs.status, 201)
    for (const view of ['all', 'mine', 'department']) {
      const user = view === 'department' ? 's-planningHead' : 's-planningMember'
      const names = (await list(s, `view=${view}`, user)).requests.flatMap(
        row => row.itemBriefs?.map(item => item.name) ?? [],
      )
      assert.deepEqual(names, ['마커'], view)
    }
  }),
)
