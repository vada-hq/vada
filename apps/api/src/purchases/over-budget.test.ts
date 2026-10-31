import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, PurchaseRequestDetail } from '@vada/contracts'
import { detailOf, errorOf, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

// 규칙 12: 예산을 넘는 승인은 막지 않고, 초과 사실을 승인 결재 기록의 사유에 남긴다. 판정은 서버의 예산 셈이다.

const FINANCE = 's-financeMember'
const ITEM_NAME = '마커'

// 지출 항목 둘(소모품 10만, 행사 20만)을 둔다.
async function budgets(s: PurchaseKit) {
  const root = `/api/organizations/${s.council.councilId}`
  await s.api.post(
    `${root}/fiscal-periods`,
    { name: '2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
    FINANCE,
  )
  await s.api.post(`${root}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
  await s.api.post(`${root}/budget-items`, { purpose: '행사', amount: 200000 }, FINANCE)
  const view = (await (await s.api.get(`${root}/budget`, FINANCE)).json()) as BudgetResponse
  return { small: view.items[0]!.id, large: view.items[1]!.id }
}

const requestWith = (s: PurchaseKit, names: string[]) =>
  s.made({ title: '요청', items: names.map(name => ({ name, quantity: 1 })) })
const approval = (lineItemId: string, amount: number, budgetItemId: string) => ({
  lineItemId,
  outcome: 'approved',
  amount,
  budgetItemId,
})
const decide = (s: PurchaseKit, request: PurchaseRequestDetail, decisions: object[]) =>
  s.api.post(`${s.base}/${request.id}/decisions`, { decisions }, FINANCE)
async function decided(s: PurchaseKit, request: PurchaseRequestDetail, decisions: object[]) {
  const response = await decide(s, request, decisions)
  assert.equal(response.status, 200)
  return detailOf(response)
}
const reasonOf = (detail: PurchaseRequestDetail, lineItemId: string) =>
  detail.decisions.find(decision => decision.lineItemId === lineItemId)?.reason

test(
  '초과 승인은 막지 않고 승인 결재 기록과 판에 승인 뒤 사용 가능을 남긴다. 상세에도 같은 값이다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const request = await requestWith(s, [ITEM_NAME])
    const id = request.items[0]!.id
    const detail = await decided(s, request, [approval(id, 120000, small)])
    assert.equal(detail.items[0]!.status, 'approved')
    assert.equal(detail.items[0]!.amount, 120000)
    const text = '예산 초과 (사용 가능 -20,000원)'
    assert.equal(reasonOf(detail, id), text)
    const read = await detailOf(await s.api.get(`${s.base}/${request.id}`, 's-plain'))
    assert.equal(reasonOf(read, id), text)
    const saved = await s.pg.query<{ reason: string; data: { reason: string } }>(
      `SELECT a.reason, v.data FROM approval a JOIN record_version v ON v.record_id = a.id
        WHERE a.target_id = $1`,
      [id],
    )
    assert.equal(saved.rows[0]!.reason, text)
    assert.equal(saved.rows[0]!.data.reason, text)
  }),
)

test(
  '사용 가능 안의 승인은 사유가 비어 있다: 사용 가능과 꼭 같은 금액까지',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const request = await requestWith(s, [ITEM_NAME])
    const id = request.items[0]!.id
    assert.equal(reasonOf(await decided(s, request, [approval(id, 100000, small)]), id), null)
    // 이미 다 쓴 항목에 1원만 더해도 초과다.
    const next = await requestWith(s, [ITEM_NAME])
    const nextId = next.items[0]!.id
    assert.equal(
      reasonOf(await decided(s, next, [approval(nextId, 1, small)]), nextId),
      '예산 초과 (사용 가능 -1원)',
    )
  }),
)

test(
  '먼저 승인한 품목의 약정과 결제를 센다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const paidRequest = await requestWith(s, [ITEM_NAME])
    const paid = paidRequest.items[0]!.id
    await decided(s, paidRequest, [approval(paid, 30000, small)])
    const expense = await s.api.post(
      `/api/organizations/${s.council.councilId}/expenses`,
      {
        vendor: '다이소',
        description: '마커',
        amount: 30000,
        paidOn: '2026-10-25',
        method: 'card',
        lines: [{ lineItemId: paid, amount: 30000 }],
      },
      FINANCE,
    )
    assert.equal(expense.status, 201)
    const heldRequest = await requestWith(s, [ITEM_NAME])
    const held = heldRequest.items[0]!.id
    await decided(s, heldRequest, [approval(held, 40000, small)])
    const last = await requestWith(s, [ITEM_NAME])
    const lastId = last.items[0]!.id
    assert.equal(
      reasonOf(await decided(s, last, [approval(lastId, 40000, small)]), lastId),
      '예산 초과 (사용 가능 -10,000원)',
    )
  }),
)

test(
  '취소한 승인 품목의 약정은 세지 않는다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const first = await requestWith(s, [ITEM_NAME])
    await decided(s, first, [approval(first.items[0]!.id, 90000, small)])
    await s.decide(first.items[0]!.id, 'cancelled')
    const second = await requestWith(s, [ITEM_NAME])
    const id = second.items[0]!.id
    assert.equal(reasonOf(await decided(s, second, [approval(id, 90000, small)]), id), null)
  }),
)

test(
  '부분 승인: 넘는 항목의 승인 줄에만 남고 다른 항목의 승인과 반려 사유는 그대로다',
  runPurchases(async s => {
    const { small, large } = await budgets(s)
    const request = await requestWith(s, ['넘는 품목', '안 넘는 품목', '반려 품목', '대기 품목'])
    const [over, fine, rejected, waiting] = request.items.map(item => item.id) as [
      string,
      string,
      string,
      string,
    ]
    const first = await decided(s, request, [
      approval(over, 110000, small),
      approval(fine, 50000, large),
      { lineItemId: rejected, outcome: 'rejected', reason: '이미 있어요' },
    ])
    assert.equal(reasonOf(first, over), '예산 초과 (사용 가능 -10,000원)')
    assert.equal(reasonOf(first, fine), null)
    assert.equal(reasonOf(first, rejected), '이미 있어요')
    assert.equal(reasonOf(first, waiting), undefined)
    assert.equal(first.status, 'pending')
    // 남은 품목을 나중에 승인할 때는 앞의 승인이 약정으로 든다.
    const second = await decided(s, request, [approval(waiting, 1000, small)])
    assert.equal(reasonOf(second, waiting), '예산 초과 (사용 가능 -11,000원)')
  }),
)

test(
  '한 번에 승인한 줄의 합으로 본다: 줄마다는 안 넘어도 합이 넘으면 그 항목의 줄 모두에 남는다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const request = await requestWith(s, ['하나', '둘'])
    const [one, two] = request.items.map(item => item.id) as [string, string]
    const detail = await decided(s, request, [
      approval(one, 60000, small),
      approval(two, 60000, small),
    ])
    assert.equal(reasonOf(detail, one), '예산 초과 (사용 가능 -20,000원)')
    assert.equal(reasonOf(detail, two), '예산 초과 (사용 가능 -20,000원)')
  }),
)

test(
  '거절된 결재는 기록을 남기지 않는다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const request = await requestWith(s, [ITEM_NAME])
    const id = request.items[0]!.id
    await decided(s, request, [approval(id, 120000, small)])
    const again = await decide(s, request, [approval(id, 120000, small)])
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'LINE_ITEM_DECIDED')
    assert.equal(await s.count('SELECT count(*) AS n FROM approval'), 1)
  }),
)

test(
  '화면이 초과 사실을 보낼 수 없다: 승인의 사유는 400이다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const request = await requestWith(s, [ITEM_NAME])
    const body = { ...approval(request.items[0]!.id, 1000, small), reason: '초과 아님' }
    assert.equal((await decide(s, request, [body])).status, 400)
  }),
)

test(
  // 시험 DB는 거래를 하나씩 돌려 잠금을 증명하지 못한다. 겹친 거래는 pg-smoke의 overBudgetTogetherCase가 본다.
  '결재 둘을 함께 보내면 뒤에 처리한 승인이 앞 승인을 세어 그쪽에만 남는다',
  runPurchases(async s => {
    const { small } = await budgets(s)
    const a = await requestWith(s, [ITEM_NAME])
    const b = await requestWith(s, [ITEM_NAME])
    const [left, right] = await Promise.all([
      decided(s, a, [approval(a.items[0]!.id, 70000, small)]),
      decided(s, b, [approval(b.items[0]!.id, 70000, small)]),
    ])
    const reasons = [reasonOf(left, a.items[0]!.id), reasonOf(right, b.items[0]!.id)]
    assert.deepEqual(reasons.filter(reason => reason === null).length, 1)
    assert.ok(reasons.includes('예산 초과 (사용 가능 -40,000원)'))
  }),
)
