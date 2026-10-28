import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ShipmentResponse, ShipmentTrackingResponse } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import {
  detailOf,
  errorOf,
  startPurchases,
  type PurchaseKit,
  MISSING,
} from '../test-support/purchases.js'
import { markLeft } from '../test-support/council.js'
import { setErrorReporter } from '../http/on-error.js'

const FINANCE = 's-financeMember'
const REQUESTER = 's-planningMember'
const input = (ids: string[]) => ({
  carrierId: 'kr.coupangls',
  trackingNumber: '1234567890',
  lineItemIds: ids,
})
const root = (s: PurchaseKit, id: string) => `${s.base}/${id}/shipments`
const shipmentOf = async (r: Response) => ((await r.json()) as ShipmentResponse).shipment
async function prepared(s: PurchaseKit) {
  const request = await s.made({
    title: '물품',
    items: [
      { name: '물품', quantity: 1 },
      { name: '둘', quantity: 1 },
    ],
  })
  for (const item of request.items) await s.decide(item.id, 'approved')
  return { request, ids: request.items.map(item => item.id), path: root(s, request.id) }
}
async function run(body: (s: PurchaseKit) => Promise<void>) {
  const s = await startPurchases()
  try {
    await body(s)
  } finally {
    await s.close()
  }
}

test('송장·품목은 다대다이며 고치기·취소는 이전 연결과 바꾼 사람을 판에 남긴다', () =>
  run(async s => {
    const p = await prepared(s)
    const created = await s.api.post(p.path, input(p.ids), FINANCE)
    assert.equal(created.status, 201)
    const first = await shipmentOf(created)
    assert.deepEqual(first.lineItemIds, [...p.ids].sort())
    assert.equal(first.editable, true)
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${p.request.id}`, REQUESTER))).canAddShipment,
      true,
    )
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${p.request.id}`, FINANCE))).canAddShipment,
      true,
    )
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${p.request.id}`, 's-plain'))).canAddShipment,
      false,
    )
    assert.equal(first.createdBy?.id, s.council.people.financeMember.memberId)
    assert.equal(await s.versions(first.id), 1)
    assert.equal((await s.api.post(p.path, input([p.ids[0]!]), REQUESTER)).status, 201)
    const changed = await s.api.post(
      `${p.path}/${first.id}`,
      { ...input([p.ids[1]!]), trackingNumber: '999-999', carrierId: 'kr.hanjin' },
      REQUESTER,
    )
    assert.equal(changed.status, 200)
    assert.equal(await s.versions(first.id), 2)
    assert.equal(
      (await s.api.post(`${p.path}/${first.id}/cancel`, { reason: '주문 취소' }, FINANCE)).status,
      200,
    )
    const versions = await s.pg.query<{
      data: { line_item_ids: string[] }
      changed_by: string
      reason: string | null
    }>(
      'SELECT data, changed_by, reason FROM record_version WHERE record_id=$1 ORDER BY version_no',
      [first.id],
    )
    assert.deepEqual(
      versions.rows.map(v => v.data.line_item_ids),
      [[...p.ids].sort(), [p.ids[1]], [p.ids[1]]],
    )
    assert.equal(versions.rows[1]?.changed_by, s.council.people.planningMember.memberId)
    assert.equal(versions.rows[2]?.reason, '주문 취소')
    assert.equal((await s.api.post(`${p.path}/${first.id}`, input(p.ids), FINANCE)).status, 409)
    const detail = await detailOf(await s.api.get(`${s.base}/${p.request.id}`, 's-plain'))
    assert.equal(detail.shipments.length, 2)
    assert.ok(detail.shipments.find(v => v.id === first.id)?.cancelledAt)
    await markLeft(s.pg, s.council.people.financeMember.memberId, '2026-10-26T03:00:00Z')
    const left = await detailOf(await s.api.get(`${s.base}/${p.request.id}`, 's-plain'))
    assert.match(left.shipments.find(v => v.id === first.id)!.createdBy!.name, /떠난 운영진/)
  }))

test('변경은 재정·요청자만 가능하고 다른 학생회·요청의 자료는 404다', () =>
  run(async s => {
    const p = await prepared(s)
    const own = await shipmentOf(await s.api.post(p.path, input(p.ids), REQUESTER))
    const elsewhere = await detailOf(
      await s.api.post(
        `/api/organizations/${s.other.councilId}/purchase-requests`,
        { title: '같은 물품', items: [{ name: '하나', quantity: 1 }] },
        'o-planningMember',
      ),
    )
    const another = await s.made()
    for (const user of ['s-plain', 's-president', 's-planningHead', 'o-financeMember', undefined]) {
      const status = user ? 403 : 401
      assert.equal((await s.api.post(p.path, input(p.ids), user)).status, status)
      assert.equal((await s.api.post(`${p.path}/${own.id}`, input(p.ids), user)).status, status)
      assert.equal(
        (await s.api.post(`${p.path}/${own.id}/cancel`, { reason: '물품' }, user)).status,
        status,
      )
    }
    assert.equal(
      (await s.api.post(root(s, elsewhere.id), input(elsewhere.items.map(i => i.id)), FINANCE))
        .status,
      404,
    )
    for (const id of [elsewhere.items[0]!.id, another.items[0]!.id, MISSING])
      assert.equal((await s.api.post(p.path, input([p.ids[0]!, id]), FINANCE)).status, 404)
    assert.equal(
      (await s.api.post(`${root(s, another.id)}/${own.id}`, input([another.items[0]!.id]), FINANCE))
        .status,
      404,
    )
    assert.equal((await s.api.get(`${p.path}/${own.id}/tracking`)).status, 401)
    assert.equal((await s.api.get(`${p.path}/${own.id}/tracking`, 's-plain')).status, 200)
    assert.equal(
      (await s.api.get(`${root(s, elsewhere.id)}/${own.id}/tracking`, FINANCE)).status,
      404,
    )
    assert.equal(await s.count('SELECT count(*) AS n FROM shipment'), 1)
  }))

test('승인 밖 품목·완료 행사는 거절하고 기록·판을 남기지 않는다', () =>
  run(async s => {
    const p = await prepared(s)
    const pending = await s.made()
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${pending.id}`, REQUESTER))).canAddShipment,
      false,
    )
    const before = await s.count('SELECT count(*) AS n FROM record')
    for (const outcome of [null, 'rejected', 'cancelled'] as const) {
      if (outcome) await s.decide(pending.items[0]!.id, outcome)
      assert.equal(
        (await s.api.post(root(s, pending.id), input(pending.items.map(i => i.id)), REQUESTER))
          .status,
        409,
      )
    }
    assert.equal(await s.count('SELECT count(*) AS n FROM shipment'), 0)
    assert.equal(await s.count('SELECT count(*) AS n FROM record'), before + 2)
    const shipment = await shipmentOf(await s.api.post(p.path, input(p.ids), FINANCE))
    const event = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: s.council.councilId,
        actor: s.council.people.president.memberId,
        values: { name: '물품' },
      }),
    )
    await s.pg.query('UPDATE request SET event_id=$1 WHERE id=$2', [event, p.request.id])
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: s.council.councilId,
        actor: s.council.people.president.memberId,
        values: {
          targetId: event,
          targetKind: 'event',
          outcome: 'completed',
          actorId: s.council.people.president.memberId,
          actorKind: 'member',
          actedAt: clockNow,
        },
      }),
    )
    for (const [path, body] of [
      [p.path, input(p.ids)],
      [`${p.path}/${shipment.id}`, input(p.ids)],
      [`${p.path}/${shipment.id}/cancel`, { reason: '물품' }],
    ] as const) {
      const r = await s.api.post(path, body, FINANCE)
      assert.equal(r.status, 409)
      assert.equal(await errorOf(r), 'EVENT_COMPLETED')
    }
    assert.equal(await s.versions(shipment.id), 1)
    assert.equal(
      (await detailOf(await s.api.get(`${s.base}/${p.request.id}`, REQUESTER))).canAddShipment,
      false,
    )
  }))

test('잘못된 송장 입력은 인증 전에 400이며 아무것도 남지 않는다', () =>
  run(async s => {
    const p = await prepared(s)
    for (const patch of [
      { trackingNumber: '' },
      { trackingNumber: ' ' },
      { trackingNumber: '1'.repeat(51) },
      { trackingNumber: '😀'.repeat(51) },
      { trackingNumber: '123a' },
      { trackingNumber: '12\u0000' },
      { trackingNumber: '\ud800' },
      { carrierId: 'unknown' },
      { extra: 1 },
      { lineItemIds: [] },
      { lineItemIds: [p.ids[0], p.ids[0]] },
    ])
      assert.equal((await s.api.post(p.path, { ...input(p.ids), ...patch })).status, 400)
    assert.equal(await s.count('SELECT count(*) AS n FROM shipment'), 0)
  }))

test('조회 실패도 200과 링크를 주고 업체 원문을 로그·Sentry로 보내지 않는다', async () => {
  const calls: unknown[] = []
  const reported: unknown[] = []
  const s = await startPurchases({
    deliveryLookup: async parcel => {
      calls.push(parcel)
      throw new Error(`PRIVATE-${parcel.trackingNumber}`)
    },
  })
  const original = console.error
  console.error = (...args: unknown[]) => {
    reported.push(args)
  }
  setErrorReporter((...args) => {
    reported.push(args)
  })
  try {
    const p = await prepared(s)
    const shipment = await shipmentOf(await s.api.post(p.path, input(p.ids), REQUESTER))
    const response = await s.api.get(`${p.path}/${shipment.id}/tracking`, 's-plain')
    assert.equal(response.status, 200)
    const data = (await response.json()) as ShipmentTrackingResponse
    assert.equal(data.reason, 'provider_failed')
    assert.ok(data.trackingUrl)
    assert.deepEqual(calls, [{ carrierId: 'kr.coupangls', trackingNumber: '1234567890' }])
    assert.deepEqual(reported, [])
  } finally {
    console.error = original
    setErrorReporter(undefined)
    await s.close()
  }
})

test('조회 키가 없어도 상세는 배송 줄을 주고 조회는 200 not_configured다', () =>
  run(async s => {
    const p = await prepared(s)
    const shipment = await shipmentOf(await s.api.post(p.path, input(p.ids), REQUESTER))
    const detail = await detailOf(await s.api.get(`${s.base}/${p.request.id}`, 's-plain'))
    assert.equal(detail.shipments[0]?.editable, false)
    assert.equal(detail.progress?.hasShipment, true)
    const response = await s.api.get(`${p.path}/${shipment.id}/tracking`, 's-plain')
    assert.equal(response.status, 200)
    const data = (await response.json()) as ShipmentTrackingResponse
    assert.equal(data.reason, 'not_configured')
    assert.equal(data.lastEvent, null)
    assert.match(data.trackingUrl, /^https:/)
    assert.equal(
      (await s.api.post(`${p.path}/${shipment.id}/cancel`, { reason: '주문 취소' }, REQUESTER))
        .status,
      200,
    )
    const cancelled = await detailOf(await s.api.get(`${s.base}/${p.request.id}`, 's-plain'))
    assert.equal(cancelled.progress?.hasShipment, false)
  }))

test('상세는 업체를 부르지 않고 조회 성공만 송장별 10분 동안 공유한다', async () => {
  const calls: unknown[] = []
  const lastEvent = {
    time: '2026-10-26T03:00:00Z',
    status: { code: 'IN_TRANSIT', name: '배송 중' },
    description: '이동 중',
  }
  const s = await startPurchases({
    deliveryLookup: async parcel => {
      calls.push(parcel)
      return { lastEvent, reason: null }
    },
  })
  try {
    const p = await prepared(s)
    const first = await shipmentOf(await s.api.post(p.path, input(p.ids), REQUESTER))
    const second = await shipmentOf(await s.api.post(p.path, input([p.ids[0]!]), FINANCE))
    await s.api.get(`${s.base}/${p.request.id}`, 's-plain')
    assert.equal(calls.length, 0)
    for (const id of [first.id, second.id]) {
      const response = await s.api.get(`${p.path}/${id}/tracking`, 's-plain')
      assert.equal(response.status, 200)
      const data = (await response.json()) as ShipmentTrackingResponse
      assert.deepEqual(data.lastEvent, lastEvent)
      assert.equal(data.reason, null)
    }
    assert.deepEqual(calls, [{ carrierId: 'kr.coupangls', trackingNumber: '1234567890' }])
    s.setNow(new Date('2026-10-25T03:10:00Z'))
    await s.api.get(`${p.path}/${first.id}/tracking`, 's-plain')
    assert.equal(calls.length, 2)
    await s.api.post(`${p.path}/${first.id}/cancel`, { reason: '취소' }, REQUESTER)
    const cancelled = await s.api.get(`${p.path}/${first.id}/tracking`, 's-plain')
    assert.equal(((await cancelled.json()) as ShipmentTrackingResponse).reason, 'cancelled')
    assert.equal(calls.length, 2)
  } finally {
    await s.close()
  }
})

test('고치기가 승인 밖 품목으로 막히면 기존 송장·연결·판이 그대로다', () =>
  run(async s => {
    const p = await prepared(s)
    const shipment = await shipmentOf(await s.api.post(p.path, input(p.ids), REQUESTER))
    await s.decide(p.ids[0]!, 'cancelled')
    const response = await s.api.post(
      `${p.path}/${shipment.id}`,
      { ...input(p.ids), trackingNumber: '99999' },
      REQUESTER,
    )
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'LINE_ITEM_NOT_SHIPPABLE')
    assert.equal(await s.versions(shipment.id), 1)
    const detail = await detailOf(await s.api.get(`${s.base}/${p.request.id}`, REQUESTER))
    assert.equal(detail.shipments[0]?.trackingNumber, '1234567890')
    assert.deepEqual(detail.shipments[0]?.lineItemIds, [...p.ids].sort())
    // 취소는 배송 연결의 현재 품목 상태와 무관하게 할 수 있다.
    assert.equal(
      (await s.api.post(`${p.path}/${shipment.id}/cancel`, { reason: '배송 취소' }, REQUESTER))
        .status,
      200,
    )
  }))
