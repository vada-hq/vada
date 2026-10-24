import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clockNow, createRecord } from '../records/records.js'
import {
  detailOf,
  endpointOf,
  errorOf,
  MISSING,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const REQUESTER = 's-planningMember'
const emoji = (n: number) => '😀'.repeat(n)
const two = {
  title: '마커와 자석',
  items: [
    { name: '마커', quantity: 3 },
    { name: '자석', quantity: 2 },
  ],
}

const cancel = (
  s: PurchaseKit,
  [requestId, itemId]: [string, string],
  reason: unknown,
  user = FINANCE,
) => s.api.post(`${s.base}/${requestId}/items/${itemId}/cancel`, { reason }, user)
const cancelledCount = (s: PurchaseKit) =>
  s.count("SELECT count(*) AS n FROM approval WHERE outcome = 'cancelled'")
const detail = async (s: PurchaseKit, requestId: string, user = FINANCE) =>
  detailOf(await s.api.get(`${s.base}/${requestId}`, user))

// 승인한 품목 둘짜리 요청
async function approvedRequest(s: PurchaseKit, user = REQUESTER) {
  const request = await s.made(two, user)
  for (const item of request.items) await s.decide(item.id, 'approved')
  s.calls.length = 0
  return { request, first: request.items[0]!.id, second: request.items[1]!.id }
}

// 지출을 적어 품목을 결제한다. 돌려주는 것은 지출 번호다.
function pay(s: PurchaseKit, itemId: string) {
  const base = {
    councilId: s.council.councilId,
    actor: s.council.people.financeMember.memberId,
  }
  return s.db.transaction(async tx => {
    const id = await createRecord(tx, {
      ...base,
      kind: 'expense',
      values: {
        amount: '10000',
        paidAt: clockNow,
        description: '마커',
        vendor: '문구점',
        method: 'card',
        reason: '행사 준비',
        budgetItemId: null,
        paidBy: base.actor,
      },
    })
    await createRecord(tx, {
      ...base,
      kind: 'payment_line',
      values: { expenseId: id, lineItemId: itemId, amount: '10000' },
    })
    return id
  })
}

test(
  '승인한 품목을 취소하면 200이고 품목이 취소됨, 결재 이력에 승인과 취소(사유, 나)가 남고 동작이 사라진다',
  runPurchases(async s => {
    const { request, first, second } = await approvedRequest(s)
    const before = await detail(s, request.id)
    assert.deepEqual(
      before.items.map(item => item.actions),
      [['line_item.cancel'], ['line_item.cancel']],
    )
    const response = await cancel(s, [request.id, first], ' 사지 않기로 했어요 ')
    assert.equal(response.status, 200)
    const after = await detailOf(response)
    assert.deepEqual(
      after.items.map(item => [item.status, item.actions]),
      [
        ['cancelled', []],
        ['approved', ['line_item.cancel']],
      ],
    )
    assert.equal(after.status, 'partial')
    assert.deepEqual(
      after.decisions
        .filter(item => item.lineItemId === first)
        .map(item => [item.outcome, item.reason, item.by?.name]),
      [
        ['approved', null, 's financeMember'],
        ['cancelled', '사지 않기로 했어요', 's financeMember'],
      ],
    )
    assert.equal(await cancelledCount(s), 1)
    // 모두 취소하면 요청이 취소다.
    const last = await detailOf(await cancel(s, [request.id, second], '필요 없어요'))
    assert.equal(last.status, 'cancelled')
  }),
)

test(
  '알림: 요청한 사람에게 기록 하나와 휴대폰 알림 한 번, 자기 요청이면 없다',
  runPurchases(async s => {
    const { request, first } = await approvedRequest(s)
    const before = await s.notices()
    await cancel(s, [request.id, first], '사지 않아요')
    await s.settled()
    assert.equal(await s.notices(), before + 1)
    const [row] = (
      await s.pg.query<{ type: string; recipient_id: string; record_id: string }>(
        "SELECT type, recipient_id, record_id FROM notification WHERE type = 'changed'",
      )
    ).rows
    assert.deepEqual(
      [row!.type, row!.recipient_id, row!.record_id],
      ['changed', s.council.people.planningMember.memberId, request.id],
    )
    assert.equal(s.calls.length, 1)
    const [target, message] = s.calls[0]!
    assert.equal(target.endpoint, endpointOf('s-planningMember'))
    assert.deepEqual(message, {
      title: '구매 품목이 취소됐어요',
      body: 's financeMember: 마커와 자석',
      url: `/purchases/${s.council.councilId}/${request.id}`,
      tag: `request:${request.id}`,
    })
    const mine = await approvedRequest(s, FINANCE)
    const count = await s.notices()
    await cancel(s, [mine.request.id, mine.first], '사지 않아요')
    await s.settled()
    assert.equal(await s.notices(), count)
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '대기·반려·이미 취소·결제한 품목과 취소한 요청은 409 LINE_ITEM_NOT_CANCELLABLE이고 기록이 없다',
  runPurchases(async s => {
    const request = await s.made({
      ...two,
      items: [...two.items, { name: '테이프', quantity: 1 }, { name: '펜', quantity: 1 }],
    })
    const [pending, rejected, again, paid] = request.items.map(item => item.id) as [
      string,
      string,
      string,
      string,
    ]
    await s.decide(rejected, 'rejected')
    await s.decide(again, 'approved')
    await s.decide(again, 'cancelled')
    await s.decide(paid, 'approved')
    await pay(s, paid)
    const before = [await cancelledCount(s), await s.notices()]
    await s.settled()
    s.calls.length = 0
    for (const id of [pending, rejected, again, paid]) {
      const response = await cancel(s, [request.id, id], '사유')
      assert.equal(response.status, 409, id)
      assert.equal(await errorOf(response), 'LINE_ITEM_NOT_CANCELLABLE', id)
    }
    assert.deepEqual([await cancelledCount(s), await s.notices()], before)
    await s.settled()
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '결제한 품목의 지출을 취소해 결제가 없어지면 다시 취소할 수 있다',
  runPurchases(async s => {
    const { request, first } = await approvedRequest(s)
    const expense = await pay(s, first)
    assert.deepEqual((await detail(s, request.id)).items[0]!.actions, [])
    await s.pg.query('UPDATE expense SET cancelled_at = now() WHERE id = $1', [expense])
    assert.deepEqual((await detail(s, request.id)).items[0]!.actions, ['line_item.cancel'])
    assert.equal((await cancel(s, [request.id, first], '사유')).status, 200)
  }),
)

test(
  '완료한 행사의 요청 품목은 409 EVENT_COMPLETED이고 완료를 취소하면 된다',
  runPurchases(async s => {
    const actor = s.council.people.president.memberId
    const event = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: s.council.councilId,
        actor,
        values: { name: '봄 축제', startsAt: new Date('2026-10-20T00:00:00Z') },
      }),
    )
    const request = await s.made({ ...two, eventId: event })
    const first = request.items[0]!.id
    await s.decide(first, 'approved')
    const complete = (outcome: 'completed' | 'completion_cancelled', at: string) =>
      s.db.transaction(tx =>
        createRecord(tx, {
          kind: 'approval',
          councilId: s.council.councilId,
          actor,
          values: {
            targetId: event,
            targetKind: 'event',
            outcome,
            actorId: actor,
            actorKind: 'member',
            actedAt: new Date(at),
            reason: null,
          },
        }),
      )
    await complete('completed', '2026-10-24T03:00:00Z')
    const locked = await cancel(s, [request.id, first], '사유')
    assert.equal(await errorOf(locked), 'EVENT_COMPLETED')
    assert.deepEqual((await detail(s, request.id)).items[0]!.actions, [])
    assert.equal(await cancelledCount(s), 0)
    await complete('completion_cancelled', '2026-10-24T04:00:00Z')
    assert.equal((await cancel(s, [request.id, first], '사유')).status, 200)
  }),
)

test(
  '재정부가 아니면 403(409보다 먼저), 다른 요청·다른 학생회의 품목은 404, 미인증은 401이다',
  runPurchases(async s => {
    const { request, first } = await approvedRequest(s)
    const other = await approvedRequest(s)
    for (const user of [REQUESTER, 's-president', 's-plain'])
      assert.equal((await cancel(s, [request.id, first], '사유', user)).status, 403, user)
    // 대기 품목이어도 재정부가 아니면 403이 먼저다.
    const fresh = await s.made(two)
    assert.equal((await cancel(s, [fresh.id, fresh.items[0]!.id], '사유', REQUESTER)).status, 403)
    assert.equal((await cancel(s, [request.id, other.first], '사유')).status, 404)
    assert.equal((await cancel(s, [request.id, MISSING], '사유')).status, 404)
    assert.equal((await cancel(s, [MISSING, first], '사유')).status, 404)
    assert.equal((await cancel(s, [request.id, 'x'], '사유')).status, 404)
    assert.equal((await cancel(s, [request.id, first], '사유', 'o-financeMember')).status, 403)
    const theirs = `/api/organizations/${s.other.councilId}/purchase-requests/${request.id}/items/${first}/cancel`
    assert.equal((await s.api.post(theirs, { reason: '사유' }, 'o-financeMember')).status, 404)
    const anonymous = await s.api.post(`${s.base}/${request.id}/items/${first}/cancel`, {
      reason: '사유',
    })
    assert.equal(anonymous.status, 401)
    assert.equal(await cancelledCount(s), 0)
    const view = await detail(s, request.id, REQUESTER)
    assert.deepEqual(
      view.items.map(item => item.actions),
      [[], []],
    )
  }),
)

test(
  '사유 입력: 필수, 공백만·NUL·서러게이트·501자·모르는 키는 400이고 500자는 된다',
  runPurchases(async s => {
    const { request, first } = await approvedRequest(s)
    const bad: [string, unknown][] = [
      ['없음', undefined],
      ['빈칸', ''],
      ['공백만', '  \n '],
      ['501자', emoji(501)],
      ['NUL', 'a\u0000'],
      ['서러게이트', 'a\uD800'],
      ['숫자', 1],
    ]
    for (const [label, reason] of bad) {
      const response = await cancel(s, [request.id, first], reason)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    const extra = await s.api.post(
      `${s.base}/${request.id}/items/${first}/cancel`,
      { reason: '사유', x: 1 },
      FINANCE,
    )
    assert.equal(extra.status, 400)
    assert.equal(await cancelledCount(s), 0)
    assert.equal((await cancel(s, [request.id, first], emoji(500))).status, 200)
  }),
)
