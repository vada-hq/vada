import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 행사 귀속(DEC-81, RULE-40): 요청(지출)의 행사와 예산 항목의 행사가 둘 다 있으면 같아야 한다.
// 승인과 직접 지출은 contracts의 같은 술어(eventsAgree)를 쓴다. 술어를 지우면 두 표가 함께 실패한다.

const FINANCE = 's-financeMember'
const DAY = (value: string) => new Date(`${value}:00Z`)
const EXPENSE = { vendor: '문구점', description: '마커', amount: 10000, paidOn: '2026-10-25' }
const post = (t: SettlementKit, path: string, body: unknown) =>
  t.api.post(`/api/organizations/${t.council.councilId}${path}`, body, FINANCE)
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const records = async (t: SettlementKit) =>
  JSON.stringify((await t.pg.query('SELECT count(*)::int AS n FROM record')).rows)

type Slot = 'none' | 'A' | 'B'
const SLOTS: Slot[] = ['none', 'A', 'B']
// 둘 다 있고 서로 다른 칸만 어긋난다.
const MISMATCH = (record: Slot, item: Slot) =>
  record !== 'none' && item !== 'none' && record !== item

async function scene(t: SettlementKit) {
  const { budget } = await t.budgetOf()
  const events = {
    none: null,
    A: await t.event({ name: '봄 축제' }),
    B: await t.event({ name: '가을 축제' }),
  }
  const items = {
    none: await t.budgetItem(budget, {}),
    A: await t.budgetItem(budget, { eventId: events.A }),
    B: await t.budgetItem(budget, { eventId: events.B }),
  }
  return { events, items }
}

const decision = (line: string, budgetItemId: string) => ({
  lineItemId: line,
  outcome: 'approved',
  amount: 1000,
  budgetItemId,
})

test(
  '승인: 요청 행사 × 예산 항목 행사를 엇갈아 승인하면 A↔B만 409 EVENT_MISMATCH이고 아무것도 쓰지 않는다',
  withSettlement(async t => {
    const { events, items } = await scene(t)
    for (const requestSlot of SLOTS)
      for (const itemSlot of SLOTS) {
        const request = await t.requestWithItem(events[requestSlot])
        const before = await records(t)
        const response = await post(t, `/purchase-requests/${request.request}/decisions`, {
          decisions: [decision(request.line, items[itemSlot])],
        })
        const label = `${requestSlot} × ${itemSlot}`
        if (MISMATCH(requestSlot, itemSlot)) {
          assert.equal(response.status, 409, label)
          assert.equal(await errorOf(response), 'EVENT_MISMATCH', label)
          assert.equal(await records(t), before, label)
        } else assert.equal(response.status, 200, label)
      }
  }),
)

test(
  '승인: 한 번에 보낸 품목 가운데 하나만 어긋나도 409이고 다른 품목의 결재 기록과 금액도 바뀌지 않는다',
  withSettlement(async t => {
    const { events, items } = await scene(t)
    const request = await t.requestWithItem(events.A)
    const second = await t.make(t.council, 'line_item', {
      requestId: request.request,
      name: '자석',
      quantity: 1,
    })
    const before = await records(t)
    const response = await post(t, `/purchase-requests/${request.request}/decisions`, {
      decisions: [decision(request.line, items.A), decision(second, items.B)],
    })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EVENT_MISMATCH')
    assert.equal(await records(t), before)
    const approvals = await t.pg.query('SELECT count(*)::int AS n FROM approval')
    assert.equal((approvals.rows[0] as { n: number }).n, 0)
  }),
)

test(
  '직접 지출: 지출 행사 × 예산 항목 행사의 같은 표로 A↔B만 409 EVENT_MISMATCH다',
  withSettlement(async t => {
    const { events, items } = await scene(t)
    for (const eventSlot of SLOTS)
      for (const itemSlot of SLOTS) {
        const response = await post(t, '/expenses', {
          ...EXPENSE,
          budgetItemId: items[itemSlot],
          ...(events[eventSlot] ? { eventId: events[eventSlot] } : {}),
        })
        const label = `${eventSlot} × ${itemSlot}`
        // 행사를 비우면 항목의 행사로 채우므로 어긋나지 않는다.
        if (MISMATCH(eventSlot, itemSlot)) {
          assert.equal(response.status, 409, label)
          assert.equal(await errorOf(response), 'EVENT_MISMATCH', label)
        } else assert.equal(response.status, 201, label)
      }
  }),
)

test(
  'A 요청을 A 항목으로 승인한 뒤 다른 행사 B를 완료해도 A 품목을 결제할 수 있다',
  withSettlement(async t => {
    const { events, items } = await scene(t)
    const request = await t.requestWithItem(events.A)
    const approved = await post(t, `/purchase-requests/${request.request}/decisions`, {
      decisions: [decision(request.line, items.A)],
    })
    assert.equal(approved.status, 200)
    await t.completion(events.B!, 'completed', DAY('2026-10-24T03:00'))
    const paid = await post(t, '/expenses', {
      ...EXPENSE,
      amount: 1000,
      lines: [{ lineItemId: request.line, amount: 1000 }],
    })
    assert.equal(paid.status, 201)
  }),
)
