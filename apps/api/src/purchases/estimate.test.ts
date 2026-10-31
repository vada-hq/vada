import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WON_MAX, type BudgetResponse, type PurchaseRequestsResponse } from '@vada/contracts'
import { detailOf, ITEM, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

test(
  '예상 단가·배송비가 판과 상세·목록에 남고 승인 금액은 비어 있다',
  runPurchases(async s => {
    const request = await s.made({
      title: '음료',
      body: '\n음료 준비 요청\n둘째 줄',
      items: [{ ...ITEM, estimatedUnitPrice: 63200, estimatedShippingFee: 3000 }],
    })
    assert.equal(request.items[0]!.estimatedUnitPrice, 63200)
    assert.equal(request.items[0]!.estimatedShippingFee, 3000)
    assert.equal(request.items[0]!.amount, null)
    assert.deepEqual(request.estimate, { subtotal: 189600, total: 192600 })
    const saved = await detailOf(await s.api.get(`${s.base}/${request.id}`, 's-financeMember'))
    assert.deepEqual(saved.estimate, request.estimate)
    const list = (await (
      await s.api.get(`${s.base}?view=all`, 's-plain')
    ).json()) as PurchaseRequestsResponse
    assert.deepEqual(list.requests[0]!.estimate, request.estimate)
    assert.equal(list.requests[0]!.bodyPreview, '음료 준비 요청')
    const version = await s.pg.query<{
      data: { estimated_unit_price: string; estimated_shipping_fee: string; amount: null }
    }>('SELECT data FROM record_version WHERE record_id = $1 AND version_no = 1', [
      request.items[0]!.id,
    ])
    assert.equal(Number(version.rows[0]!.data.estimated_unit_price), 63200)
    assert.equal(Number(version.rows[0]!.data.estimated_shipping_fee), 3000)
    assert.equal(version.rows[0]!.data.amount, null)
    assert.equal((await s.api.get(`${s.base}/${request.id}`, 'o-president')).status, 403)
    assert.equal(
      (
        await s.api.get(
          `/api/organizations/${s.other.councilId}/purchase-requests/${request.id}`,
          'o-president',
        )
      ).status,
      404,
    )
  }),
)

test(
  '기존 입력과 미확인 배송비는 null이며 무료를 0으로 구별한다',
  runPurchases(async s => {
    const old = await s.made({ title: '기존 요청', items: [ITEM] })
    assert.equal(old.items[0]!.estimatedUnitPrice, null)
    assert.equal(old.items[0]!.estimatedShippingFee, null)
    assert.deepEqual(old.estimate, { subtotal: null, total: null })
    const partial = await s.made({
      title: '배송 미확인',
      body: `${'a'.repeat(99)}😀뒤에 적은 글`,
      items: [
        { ...ITEM, estimatedUnitPrice: 100 },
        { name: '무료', quantity: 1, estimatedUnitPrice: 0, estimatedShippingFee: 0 },
      ],
    })
    assert.deepEqual(partial.estimate, { subtotal: 300, total: null })
    assert.equal(partial.bodyPreview, `${'a'.repeat(99)}😀`)
  }),
)

test(
  '잘못된 예상 금액은 400이고 요청이 생성되지 않는다',
  runPurchases(async s => {
    for (const item of [
      { estimatedUnitPrice: -1 },
      { estimatedShippingFee: 1.5 },
      { estimatedUnitPrice: WON_MAX + 1 },
      { estimatedShippingFee: WON_MAX + 1 },
      { estimatedUnitPrice: WON_MAX },
      { quantity: 1, estimatedUnitPrice: WON_MAX, estimatedShippingFee: 1 },
    ])
      assert.equal(
        (await s.create({ title: '잘못된 요청', items: [{ ...ITEM, ...item }] })).status,
        400,
      )
    assert.equal(Number(await s.count('SELECT count(*) AS n FROM request')), 0)
  }),
)

test(
  '예상값은 예산을 차감하지 않고 결재자가 정한 금액만 승인·약정에 쓰인다',
  runPurchases(async s => {
    const root = `/api/organizations/${s.council.councilId}`
    const finance = 's-financeMember'
    await s.api.post(
      `${root}/fiscal-periods`,
      { name: '2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
      finance,
    )
    const budget = (await (
      await s.api.post(`${root}/budget-items`, { purpose: '물품', amount: 100000 }, finance)
    ).json()) as BudgetResponse
    const request = await s.made({
      title: '음료',
      items: [{ ...ITEM, estimatedUnitPrice: 100, estimatedShippingFee: 30 }],
    })
    const usage = async () =>
      ((await (await s.api.get(`${root}/budget`, finance)).json()) as BudgetResponse).items[0]!
    assert.equal((await usage()).committed, 0)
    assert.equal((await usage()).available, 100000)
    const response = await s.api.post(
      `${s.base}/${request.id}/decisions`,
      {
        decisions: [
          {
            lineItemId: request.items[0]!.id,
            outcome: 'approved',
            amount: 777,
            budgetItemId: budget.items[0]!.id,
          },
        ],
      },
      finance,
    )
    assert.equal(response.status, 200)
    const approved = await detailOf(response)
    assert.equal(approved.items[0]!.amount, 777)
    assert.equal(approved.items[0]!.estimatedUnitPrice, 100)
    assert.deepEqual(approved.estimate, { subtotal: 300, total: 330 })
    assert.equal((await usage()).committed, 777)
    assert.equal((await usage()).available, 99223)
  }),
)

test(
  '수량 상한 99,999: 단가 × 수량 + 배송비가 금액 상한까지는 저장되고 1원이라도 넘으면 400이다',
  runPurchases(async s => {
    const edge = { name: '기념품', quantity: 99_999, estimatedUnitPrice: 10_000 }
    const full = await s.made({
      title: '상한',
      items: [{ ...edge, estimatedShippingFee: WON_MAX - 99_999 * 10_000 }],
    })
    assert.deepEqual(full.estimate, { subtotal: 999_990_000, total: WON_MAX })
    const before = await s.count('SELECT count(*) AS n FROM request')
    for (const item of [
      { ...edge, estimatedUnitPrice: 10_001 },
      { ...edge, estimatedShippingFee: WON_MAX - 99_999 * 10_000 + 1 },
    ])
      assert.equal((await s.create({ title: '넘음', items: [item] })).status, 400)
    assert.equal(await s.count('SELECT count(*) AS n FROM request'), before)
    // 예상 단가가 없는 상한 수량은 금액 칸이 없어 그대로 받는다.
    const bare = await s.made({ title: '수량만', items: [{ name: '기념품', quantity: 99_999 }] })
    assert.equal(bare.items[0]!.quantity, 99_999)
  }),
)

test(
  'DB도 단가 × 수량 + 배송비가 금액 상한을 넘는 품목을 막는다',
  runPurchases(async s => {
    const made = await s.made({ title: '기념품', items: [{ name: '기념품', quantity: 99_999 }] })
    await assert.rejects(
      s.pg.query('UPDATE line_item SET estimated_unit_price = 10001 WHERE id = $1', [
        made.items[0]!.id,
      ]),
    )
  }),
)

const listed = async (s: PurchaseKit, id: string) => {
  const list = (await (
    await s.api.get(`${s.base}?view=all`, 's-plain')
  ).json()) as PurchaseRequestsResponse
  return list.requests.find(request => request.id === id)!
}
const read = async (s: PurchaseKit, id: string) =>
  detailOf(await s.api.get(`${s.base}/${id}`, 's-financeMember'))
// 목록과 상세가 같은 값인지 함께 본다.
async function expectSummary(
  s: PurchaseKit,
  id: string,
  expected: { itemCount: number; estimate: { subtotal: number | null; total: number | null } },
) {
  for (const summary of [await listed(s, id), await read(s, id)]) {
    assert.equal(summary.itemCount, expected.itemCount)
    assert.deepEqual(summary.estimate, expected.estimate)
  }
}

const BUY = { name: '살 것', quantity: 2, estimatedUnitPrice: 100, estimatedShippingFee: 30 }
const DROP = { name: '뺄 것', quantity: 1, estimatedUnitPrice: 1000, estimatedShippingFee: 500 }

test(
  '요청의 예상 금액과 품목 수는 반려·취소 품목을 빼고 그 품목의 배송비도 뺀다',
  runPurchases(async s => {
    const request = await s.made({ title: '혼합', items: [BUY, DROP, DROP, BUY] })
    await expectSummary(s, request.id, {
      itemCount: 4,
      estimate: { subtotal: 2400, total: 3460 },
    })
    await s.decide(request.items[1]!.id, 'rejected')
    await expectSummary(s, request.id, {
      itemCount: 3,
      estimate: { subtotal: 1400, total: 1960 },
    })
    await s.decide(request.items[2]!.id, 'approved')
    await s.decide(request.items[2]!.id, 'cancelled')
    await s.decide(request.items[3]!.id, 'approved')
    await expectSummary(s, request.id, {
      itemCount: 2,
      estimate: { subtotal: 400, total: 460 },
    })
    // 품목 목록과 요청 상태는 그대로 넷을 본다.
    const detail = await read(s, request.id)
    assert.equal(detail.items.length, 4)
    assert.equal(detail.status, 'pending')
  }),
)

test(
  '반려한 품목의 모르는 값은 합계를 모르게 하지 않고, 살 품목의 모르는 값은 그대로 모른다',
  runPurchases(async s => {
    const unknownShipping = await s.made({
      title: '배송비 미확인 반려',
      items: [BUY, { ...DROP, estimatedShippingFee: null }],
    })
    await expectSummary(s, unknownShipping.id, {
      itemCount: 2,
      estimate: { subtotal: 1200, total: null },
    })
    await s.decide(unknownShipping.items[1]!.id, 'rejected')
    await expectSummary(s, unknownShipping.id, {
      itemCount: 1,
      estimate: { subtotal: 200, total: 230 },
    })
    const unknownPrice = await s.made({ title: '단가 미확인 반려', items: [BUY, ITEM] })
    await s.decide(unknownPrice.items[1]!.id, 'rejected')
    await expectSummary(s, unknownPrice.id, {
      itemCount: 1,
      estimate: { subtotal: 200, total: 230 },
    })
    const stillUnknown = await s.made({ title: '살 품목 미확인', items: [BUY, ITEM, DROP] })
    await s.decide(stillUnknown.items[2]!.id, 'rejected')
    await expectSummary(s, stillUnknown.id, {
      itemCount: 2,
      estimate: { subtotal: null, total: null },
    })
  }),
)

test(
  '살 품목이 없으면 0개·0원이고 미확인으로 보이지 않는다: 모두 반려, 모두 취소, 요청 취소',
  runPurchases(async s => {
    const rejected = await s.made({ title: '모두 반려', items: [BUY, ITEM] })
    await s.decide(rejected.items[0]!.id, 'rejected')
    await s.decide(rejected.items[1]!.id, 'rejected')
    const cancelledItems = await s.made({ title: '모두 취소', items: [BUY] })
    await s.decide(cancelledItems.items[0]!.id, 'approved')
    await s.decide(cancelledItems.items[0]!.id, 'cancelled')
    const cancelled = await s.made({ title: '요청 취소', items: [BUY, DROP] })
    const cancel = await s.api.post(`${s.base}/${cancelled.id}/cancel`, {}, 's-planningMember')
    assert.equal(cancel.status, 204)
    for (const id of [rejected.id, cancelledItems.id, cancelled.id])
      await expectSummary(s, id, { itemCount: 0, estimate: { subtotal: 0, total: 0 } })
  }),
)
