import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WON_MAX, type BudgetResponse, type PurchaseRequestsResponse } from '@vada/contracts'
import { detailOf, ITEM, runPurchases } from '../test-support/purchases.js'

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
      await s.api.get(`${s.base}?view=all`, 's-planningMember')
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
