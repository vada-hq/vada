import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  BudgetResponse,
  PurchaseRequestDetail,
  PurchaseRequestsResponse,
} from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 고르기 목록의 판정(기능 014 조각 5): 예산 항목의 selectable, 요청과 품목의 payable은 서버가 정책에서 정하고,
// 같은 사실로 쓰기도 거절한다(완료 행사 항목으로 결재 409, 취소한 품목 결제 409).

const FINANCE = 's-financeMember'
const DONE = new Date('2026-10-24T03:00:00Z')
const EXPENSE = { vendor: '문구점', description: '마커', amount: 1000, paidOn: '2026-10-25' }
const path = (t: SettlementKit, rest: string) => `/api/organizations/${t.council.councilId}${rest}`
const get = async <T>(t: SettlementKit, rest: string) =>
  (await (await t.api.get(path(t, rest), FINANCE)).json()) as T
const budgetItems = async (t: SettlementKit) =>
  (await get<BudgetResponse>(t, '/budget')).items
const requests = async (t: SettlementKit) =>
  (await get<PurchaseRequestsResponse>(t, '/purchase-requests?view=all')).requests
const detail = async (t: SettlementKit, id: string) =>
  (await get<{ request: PurchaseRequestDetail }>(t, `/purchase-requests/${id}`)).request
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

async function scene(t: SettlementKit) {
  const { budget } = await t.budgetOf()
  const done = await t.event({ name: '끝난 축제' })
  const open = await t.event({ name: '열린 축제' })
  const items = {
    none: await t.budgetItem(budget, { purpose: '상시' }),
    done: await t.budgetItem(budget, { purpose: '끝난 항목', eventId: done }),
    open: await t.budgetItem(budget, { purpose: '열린 항목', eventId: open }),
  }
  return { done, open, items }
}

// 요청 하나(품목 하나)를 만들고 예산 항목으로 승인한다.
async function approved(t: SettlementKit, eventId: string | null, budgetItemId: string) {
  const made = await t.requestWithItem(eventId)
  await t.pg.query('UPDATE line_item SET budget_item_id = $2, amount = 1000 WHERE id = $1', [
    made.line,
    budgetItemId,
  ])
  await t.approve(made.line)
  return made
}

test(
  '예산 응답의 selectable은 완료한 행사의 항목만 false다',
  withSettlement(async t => {
    const { done, items } = await scene(t)
    await t.completion(done, 'completed', DONE)
    const byId = new Map((await budgetItems(t)).map(item => [item.id, item.selectable]))
    assert.equal(byId.get(items.none), true)
    assert.equal(byId.get(items.open), true)
    assert.equal(byId.get(items.done), false)
    // 완료를 취소하면 다시 고를 수 있다.
    await t.completion(done, 'completion_cancelled', new Date('2026-10-25T01:00:00Z'))
    const again = new Map((await budgetItems(t)).map(item => [item.id, item.selectable]))
    assert.equal(again.get(items.done), true)
  }),
)

test(
  '요청과 품목의 payable: 승인한 품목만 true이고 대기·반려·취소·취소한 요청·완료한 행사는 false다',
  withSettlement(async t => {
    const { done, open, items } = await scene(t)
    const ok = await approved(t, open, items.open)
    const pending = await t.requestWithItem(null)
    const rejected = await t.requestWithItem(null)
    await t.approve(rejected.line, 'rejected')
    const cancelledItem = await approved(t, null, items.none)
    await t.approve(cancelledItem.line, 'cancelled')
    const cancelledRequest = await approved(t, null, items.none)
    await t.pg.query('UPDATE request SET cancelled_at = now() WHERE id = $1', [
      cancelledRequest.request,
    ])
    const requestDone = await approved(t, done, items.done)
    const itemDone = await approved(t, null, items.done)
    await t.completion(done, 'completed', DONE)

    const expected = new Map([
      [ok.request, true],
      [pending.request, false],
      [rejected.request, false],
      [cancelledItem.request, false],
      [cancelledRequest.request, false],
      [requestDone.request, false],
      [itemDone.request, false],
    ])
    const listed = new Map((await requests(t)).map(request => [request.id, request.payable]))
    for (const [id, payable] of expected) {
      assert.equal(listed.get(id), payable, `목록 ${id}`)
      const view = await detail(t, id)
      assert.equal(view.payable, payable, `상세 ${id}`)
      assert.deepEqual(
        view.items.map(item => item.payable),
        [payable],
        `품목 ${id}`,
      )
    }
  }),
)

test(
  '요청의 payable은 결제할 수 있는 품목이 하나라도 있으면 true다',
  withSettlement(async t => {
    const { done, items } = await scene(t)
    const made = await approved(t, null, items.none)
    const second = await t.make(t.council, 'line_item', {
      requestId: made.request,
      name: '자석',
      quantity: 1,
      amount: '1000',
      budgetItemId: items.done,
    })
    await t.approve(second)
    await t.completion(done, 'completed', DONE)
    const view = await detail(t, made.request)
    assert.deepEqual(
      view.items.map(item => item.payable),
      [true, false],
    )
    assert.equal(view.payable, true)
    assert.equal((await requests(t)).find(r => r.id === made.request)?.payable, true)
  }),
)

test(
  '같은 판정으로 거절한다: 완료한 행사의 항목으로 결재는 409 EVENT_COMPLETED, 취소한 품목 결제는 409 LINE_ITEM_NOT_PAYABLE',
  withSettlement(async t => {
    const { done, items } = await scene(t)
    const fresh = await t.requestWithItem(null)
    const itemDone = await approved(t, null, items.done)
    const cancelled = await approved(t, null, items.none)
    await t.approve(cancelled.line, 'cancelled')
    await t.completion(done, 'completed', DONE)

    const decide = await t.api.post(
      path(t, `/purchase-requests/${fresh.request}/decisions`),
      {
        decisions: [
          { lineItemId: fresh.line, outcome: 'approved', amount: 1000, budgetItemId: items.done },
        ],
      },
      FINANCE,
    )
    assert.equal(decide.status, 409)
    assert.equal(await errorOf(decide), 'EVENT_COMPLETED')

    const payCancelled = await t.api.post(
      path(t, '/expenses'),
      { ...EXPENSE, lines: [{ lineItemId: cancelled.line, amount: 1000 }] },
      FINANCE,
    )
    assert.equal(payCancelled.status, 409)
    assert.equal(await errorOf(payCancelled), 'LINE_ITEM_NOT_PAYABLE')

    const payDone = await t.api.post(
      path(t, '/expenses'),
      { ...EXPENSE, lines: [{ lineItemId: itemDone.line, amount: 1000 }] },
      FINANCE,
    )
    assert.equal(payDone.status, 409)
    assert.equal(await errorOf(payDone), 'EVENT_COMPLETED')
  }),
)
