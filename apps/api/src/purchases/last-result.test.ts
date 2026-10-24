import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseRequestsResponse } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import { detailOf, errorOf, ITEM, runPurchases } from '../test-support/purchases.js'

// 품목의 상태는 마지막 결재 기록 하나다(기능 014 조각 1): 승인 뒤에 취소 줄이 붙어도 읽는 곳이 모두 같은 결과를 본다.
const two = { items: [ITEM, { name: '자석', quantity: 2 }] }
const FINANCE = 's-financeMember'

test(
  '승인 → 취소한 품목: 상태가 취소됨이고 결재 이력에 승인과 취소(사유)가 차례로 보인다',
  runPurchases(async s => {
    const request = await s.made({ title: '마커', ...two })
    const [first, second] = request.items
    await s.decide(first!.id, 'approved')
    await s.decide(first!.id, 'cancelled')
    const read = detailOf(await s.api.get(`${s.base}/${request.id}`, 's-president'))
    const detail = await read
    assert.deepEqual(
      detail.items.map(item => [item.name, item.status]),
      [
        ['화이트보드 마커', 'cancelled'],
        ['자석', 'pending'],
      ],
    )
    assert.deepEqual(
      detail.decisions.map(item => [item.lineItemId, item.outcome, item.reason, item.by?.name]),
      [
        [first!.id, 'approved', null, 's financeMember'],
        [first!.id, 'cancelled', '사지 않아요', 's financeMember'],
      ],
    )
    // 대기 품목이 남아 있으면 요청은 대기다.
    assert.equal(detail.status, 'pending')
    await s.decide(second!.id, 'approved')
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${request.id}`, FINANCE))).status,
      'partial',
    )
  }),
)

test(
  '요청 상태: 모두 취소는 취소, 승인과 취소는 일부 승인, 반려와 취소는 반려이고 대기 목록에서 빠진다',
  runPurchases(async s => {
    const all = await s.made({ title: '모두 취소', ...two })
    for (const item of all.items) {
      await s.decide(item.id, 'approved')
      await s.decide(item.id, 'cancelled')
    }
    const half = await s.made({ title: '승인과 취소', ...two })
    await s.decide(half.items[0]!.id, 'approved')
    await s.decide(half.items[0]!.id, 'cancelled')
    await s.decide(half.items[1]!.id, 'approved')
    const rejected = await s.made({ title: '반려와 취소', ...two })
    await s.decide(rejected.items[0]!.id, 'rejected')
    await s.decide(rejected.items[1]!.id, 'approved')
    await s.decide(rejected.items[1]!.id, 'cancelled')
    const response = await s.api.get(`${s.base}?view=all`, 's-president')
    const { requests } = (await response.json()) as PurchaseRequestsResponse
    assert.deepEqual(Object.fromEntries(requests.map(item => [item.title, item.status])), {
      '모두 취소': 'cancelled',
      '승인과 취소': 'partial',
      '반려와 취소': 'rejected',
    })
    const pending = await s.api.get(`${s.base}?view=pending`, FINANCE)
    assert.deepEqual(((await pending.json()) as PurchaseRequestsResponse).requests, [])
  }),
)

test(
  '취소한 품목을 결재하려 하면 409 LINE_ITEM_DECIDED이고 결재 기록이 늘지 않는다',
  runPurchases(async s => {
    const request = await s.made({ title: '마커', ...two })
    const [first] = request.items
    await s.decide(first!.id, 'approved')
    await s.decide(first!.id, 'cancelled')
    const before = await s.count('SELECT count(*) AS n FROM approval')
    const response = await s.api.post(
      `${s.base}/${request.id}/decisions`,
      { decisions: [{ lineItemId: first!.id, outcome: 'rejected', reason: '다시' }] },
      FINANCE,
    )
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'LINE_ITEM_DECIDED')
    // 품목이 모두 취소된 요청도 마찬가지다(요청 자체는 닫히지 않았다).
    await s.decide(request.items[1]!.id, 'approved')
    await s.decide(request.items[1]!.id, 'cancelled')
    const all = await s.api.post(
      `${s.base}/${request.id}/decisions`,
      { decisions: [{ lineItemId: first!.id, outcome: 'rejected', reason: '다시' }] },
      FINANCE,
    )
    assert.equal(await errorOf(all), 'LINE_ITEM_DECIDED')
    assert.equal(await s.count('SELECT count(*) AS n FROM approval'), before + 2)
  }),
)

test(
  '승인 → 취소 품목과 대기 품목이 있는 요청은 결재 대기 목록에 남고, 남은 품목을 결재하면 요청한 사람에게 알린다',
  runPurchases(async s => {
    const request = await s.made({ title: '마커', ...two })
    const [first, second] = request.items
    await s.decide(first!.id, 'approved')
    await s.decide(first!.id, 'cancelled')
    const pending = await s.api.get(`${s.base}?view=pending`, FINANCE)
    assert.deepEqual(
      ((await pending.json()) as PurchaseRequestsResponse).requests.map(item => item.id),
      [request.id],
    )
    s.calls.length = 0
    const before = await s.notices()
    const response = await s.api.post(
      `${s.base}/${request.id}/decisions`,
      { decisions: [{ lineItemId: second!.id, outcome: 'rejected', reason: '비싸요' }] },
      FINANCE,
    )
    assert.equal(response.status, 200)
    await s.settled()
    assert.equal(await s.notices(), before + 1)
    assert.equal(s.calls.length, 1)
    assert.equal(s.calls[0]![1].title, '구매 요청이 반려됐어요')
  }),
)
test(
  '품목 결과가 아닌 결재 줄(감사)이 마지막이어도 품목 상태와 요청 셈이 같다',
  runPurchases(async s => {
    const request = await s.made({ title: '마커', items: [ITEM] })
    await s.decide(request.items[0]!.id, 'approved')
    const who = s.council.people.financeMember.memberId
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: s.council.councilId,
        actor: who,
        values: {
          targetId: request.items[0]!.id,
          targetKind: 'line_item',
          outcome: 'audited',
          actorId: who,
          actorKind: 'member',
          actedAt: clockNow,
          reason: null,
        },
      }),
    )
    const detail = detailOf(await s.api.get(`${s.base}/${request.id}`, FINANCE))
    const after = await detail
    assert.deepEqual([after.items[0]!.status, after.status], ['approved', 'approved'])
  }),
)
