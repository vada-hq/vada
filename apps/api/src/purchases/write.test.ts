import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRateLimiter } from '../http/rate-limit.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import {
  detailOf,
  endpointOf,
  errorOf,
  ITEM,
  MISSING,
  runPurchases,
  startPurchases,
} from '../test-support/purchases.js'

const emoji = (n: number) => '😀'.repeat(n)
const requestCount = (s: { count: (sql: string) => Promise<number> }) =>
  s.count('SELECT count(*) AS n FROM request')
const itemCount = (s: { count: (sql: string) => Promise<number> }) =>
  s.count('SELECT count(*) AS n FROM line_item')

test(
  '누구나 요청을 낸다: 201, 요청한 사람은 나, 금액과 예산 항목은 빈칸, 요청과 품목마다 판 1',
  runPurchases(async s => {
    const request = await s.made(
      {
        title: '  마커 구매 ',
        body: '회의용',
        neededBy: '2026-10-30',
        items: [
          { name: ' 마커 ', quantity: 3, link: 'https://shop.example/m?a=1', options: '검정' },
          { name: '자석', quantity: 1 },
        ],
      },
      's-plain',
    )
    assert.equal(request.title, '마커 구매')
    assert.equal(request.body, '회의용')
    assert.equal(request.neededBy, '2026-10-30')
    assert.equal(request.status, 'pending')
    assert.equal(request.requestedBy.name, 's plain')
    assert.equal(request.itemCount, 2)
    assert.deepEqual(
      request.items.map(item => [item.name, item.quantity, item.link, item.options]),
      [
        ['마커', 3, 'https://shop.example/m?a=1', '검정'],
        ['자석', 1, null, null],
      ],
    )
    for (const item of request.items) {
      assert.equal(item.amount, null)
      assert.equal(item.budgetItem, null)
      assert.equal(item.status, 'pending')
      assert.equal(item.paid, false)
      assert.equal(await s.versions(item.id), 1)
    }
    assert.equal(await s.versions(request.id), 1)
    assert.deepEqual(
      request.history.map(version => version.changes),
      [[{ field: 'created' }]],
    )
    assert.deepEqual(request.actions, ['purchase_request.cancel'])
    const bare = await s.made({ title: 'a', items: [ITEM] }, 's-president')
    assert.equal(bare.body, null)
    assert.equal(bare.neededBy, null)
    assert.deepEqual(bare.actions, ['purchase_request.cancel'])
  }),
)

test(
  '상한은 받고 상한+1(이모지 포함)은 400이며 아무것도 생기지 않는다',
  runPurchases(async s => {
    const ok = await s.made({
      title: emoji(100),
      body: emoji(1000),
      items: Array.from({ length: 20 }, () => ({
        name: emoji(100),
        quantity: 999,
        link: `https://a.example/${'a'.repeat(1982)}`,
        options: emoji(200),
      })),
    })
    assert.equal(ok.itemCount, 20)
    const before = [await requestCount(s), await itemCount(s)]
    const long = `https://a.example/${'a'.repeat(1983)}`
    const bad: [string, unknown][] = [
      ['제목 없음', { items: [ITEM] }],
      ['빈 제목', { title: '', items: [ITEM] }],
      ['공백 제목', { title: '  \n ', items: [ITEM] }],
      ['제목 101자', { title: emoji(101), items: [ITEM] }],
      ['내용 1001자', { title: 'a', body: emoji(1001), items: [ITEM] }],
      ['제목 NUL', { title: 'a\u0000b', items: [ITEM] }],
      ['제목 홀로 서러게이트', { title: 'a\uD800', items: [ITEM] }],
      ['내용 NUL', { title: 'a', body: 'a\u0000', items: [ITEM] }],
      ['필요한 때 형식', { title: 'a', neededBy: '2026-13-01', items: [ITEM] }],
      ['필요한 때 시각', { title: 'a', neededBy: '2026-10-30T10:00', items: [ITEM] }],
      ['품목 없음', { title: 'a' }],
      ['품목 빈 줄', { title: 'a', items: [] }],
      ['품목 21줄', { title: 'a', items: Array.from({ length: 21 }, () => ITEM) }],
      ['품목이 배열 아님', { title: 'a', items: ITEM }],
      ['품목 이름 없음', { title: 'a', items: [{ quantity: 1 }] }],
      ['품목 이름 공백', { title: 'a', items: [{ name: ' ', quantity: 1 }] }],
      ['품목 이름 101자', { title: 'a', items: [{ name: emoji(101), quantity: 1 }] }],
      ['품목 이름 NUL', { title: 'a', items: [{ name: 'a\u0000', quantity: 1 }] }],
      ['수량 없음', { title: 'a', items: [{ name: 'a' }] }],
      ['수량 0', { title: 'a', items: [{ name: 'a', quantity: 0 }] }],
      ['수량 1000', { title: 'a', items: [{ name: 'a', quantity: 1000 }] }],
      ['수량 음수', { title: 'a', items: [{ name: 'a', quantity: -1 }] }],
      ['수량 소수', { title: 'a', items: [{ name: 'a', quantity: 1.5 }] }],
      ['수량 글자', { title: 'a', items: [{ name: 'a', quantity: '1' }] }],
      ['옵션 201자', { title: 'a', items: [{ ...ITEM, options: emoji(201) }] }],
      ['옵션 NUL', { title: 'a', items: [{ ...ITEM, options: 'a\u0000' }] }],
      ['링크 2001자', { title: 'a', items: [{ ...ITEM, link: long }] }],
      ['링크 javascript', { title: 'a', items: [{ ...ITEM, link: 'javascript:alert(1)' }] }],
      ['링크 data', { title: 'a', items: [{ ...ITEM, link: 'data:text/html,a' }] }],
      ['링크 ftp', { title: 'a', items: [{ ...ITEM, link: 'ftp://a.example/x' }] }],
      ['링크 주소 아님', { title: 'a', items: [{ ...ITEM, link: 'shop.example' }] }],
      ['링크 줄바꿈', { title: 'a', items: [{ ...ITEM, link: 'https://a.example/\nx' }] }],
      ['모르는 키', { title: 'a', items: [ITEM], extra: 1 }],
      ['금액 키', { title: 'a', items: [{ ...ITEM, amount: 1000 }] }],
      ['품목 모르는 키', { title: 'a', items: [{ ...ITEM, extra: 1 }] }],
    ]
    for (const [label, body] of bad) {
      const response = await s.create(body)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.deepEqual([await requestCount(s), await itemCount(s)], before)
  }),
)

test(
  '운영진이 아닌 사람(다른 학생회, 내보낸 사람)은 403이고 로그인하지 않으면 401이며 요청이 생기지 않는다',
  runPurchases(async s => {
    const body = { title: 'a', items: [ITEM] }
    assert.equal((await s.create(body, 'o-president')).status, 403)
    assert.equal((await s.create(body, 's-ended')).status, 403)
    assert.equal((await s.api.post(s.base, body)).status, 401)
    assert.equal(
      (await s.api.post('/api/organizations/not-a-uuid/purchase-requests', body, 's-plain')).status,
      403,
    )
    assert.equal(await requestCount(s), 0)
  }),
)

test(
  '새 요청은 재정부의 지금 부서원마다 알림 기록 하나를 남기고 기기마다 한 번 알림이 가며 누르면 그 요청이 열린다',
  runPurchases(async s => {
    const request = await s.made(
      { title: '마커 구매', items: [ITEM, { name: '자석', quantity: 2 }] },
      's-planningMember',
    )
    const rows = (
      await s.pg.query<{ recipient_id: string; record_id: string; type: string }>(
        'SELECT recipient_id, record_id, type FROM notification',
      )
    ).rows
    assert.deepEqual(rows, [
      {
        recipient_id: s.council.people.financeMember.memberId,
        record_id: request.id,
        type: 'created',
      },
    ])
    assert.equal(s.calls.length, 1)
    const [target, message, options] = s.calls[0]!
    assert.equal(target.endpoint, endpointOf('s-financeMember'))
    assert.deepEqual(message, {
      title: '구매 요청이 왔어요',
      body: 's planningMember: 마커 구매 · 품목 2개',
      url: `/purchases/${s.council.councilId}/${request.id}`,
      tag: `request:${request.id}`,
    })
    assert.equal(options?.ttl, 86_400)
  }),
)

test(
  '재정부원이 낸 요청은 자기에게 알리지 않고, 재정부가 비어 있어도 201이며, 내보낸 부서원과 다른 학생회는 받지 않는다',
  runPurchases(async s => {
    await s.made({ title: '재정부 요청', items: [ITEM] }, 's-financeMember')
    assert.equal(await s.notices(), 0)
    assert.equal(s.calls.length, 0)
    // 재정부원의 부서 소속을 끝낸다.
    const row = (
      await s.pg.query<{ id: string }>(
        'SELECT id FROM department_membership WHERE member_id = $1',
        [s.council.people.financeMember.memberId],
      )
    ).rows[0]!
    await s.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: row.id,
        actor: s.council.people.president.memberId,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    await s.made({ title: '아무도 없음', items: [ITEM] }, 's-plain')
    assert.equal(await s.notices(), 0)
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '내보낸 재정부원은 알림을 받지 않고, 다른 학생회 재정부원도 받지 않는다',
  runPurchases(async s => {
    const row = (
      await s.pg.query<{ id: string }>('SELECT id FROM council_membership WHERE member_id = $1', [
        s.council.people.financeMember.memberId,
      ])
    ).rows[0]!
    await s.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'council_membership',
        id: row.id,
        actor: s.council.people.president.memberId,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    await s.made({ title: 'a', items: [ITEM] }, 's-plain')
    assert.equal(await s.notices(), 0)
    assert.deepEqual(
      s.calls.map(call => call[0].endpoint).filter(endpoint => endpoint.includes('/o-')),
      [],
    )
  }),
)

test('알림을 보내지 못해도 201이고 기록은 남는다', async () => {
  const s = await startPurchases({ withPush: false })
  try {
    const request = await s.made({ title: 'a', items: [ITEM] }, 's-plain')
    assert.equal(request.status, 'pending')
    assert.equal(await s.notices(), 1)
    assert.equal(s.calls.length, 0)
  } finally {
    await s.close()
  }
})

test('계정마다 10초에 21번째는 429이고 다른 사람은 막히지 않으며 막힌 요청은 남지 않는다', async () => {
  const s = await startPurchases({ limiter: createRateLimiter({ limit: 20, windowMs: 10_000 }) })
  try {
    for (let index = 0; index < 20; index++)
      assert.equal((await s.create({ title: `요청 ${index}`, items: [ITEM] })).status, 201)
    const blocked = await s.create({ title: '스물한 번째', items: [ITEM] })
    assert.equal(blocked.status, 429)
    assert.equal(await errorOf(blocked), 'TOO_MANY_REQUESTS')
    assert.equal(await requestCount(s), 20)
    assert.equal((await s.create({ title: '다른 사람', items: [ITEM] }, 's-plain')).status, 201)
    assert.equal((await s.api.post(s.base, { title: 'x', items: [ITEM] })).status, 401)
  } finally {
    await s.close()
  }
})

test(
  '요청자만 취소한다: 204와 판 2, 부원에게 남의 요청은 404이고 다른 권한 실패는 403',
  runPurchases(async s => {
    const request = await s.made()
    const cancel = (user: string, id = request.id) => s.api.post(`${s.base}/${id}/cancel`, {}, user)
    for (const user of ['s-financeMember', 's-president', 's-plain', 's-ended', 'o-president'])
      assert.equal((await cancel(user)).status, user === 's-plain' ? 404 : 403, user)
    assert.equal((await s.api.post(`${s.base}/${request.id}/cancel`, {})).status, 401)
    assert.equal(await s.versions(request.id), 1)
    const done = await cancel('s-planningMember')
    assert.equal(done.status, 204)
    assert.equal(await done.text(), '')
    assert.equal(await s.versions(request.id), 2)
    const read = await detailOf(await s.api.get(`${s.base}/${request.id}`, 's-president'))
    assert.equal(read.status, 'cancelled')
    assert.deepEqual(read.actions, [])
    assert.deepEqual(
      read.history.map(version => version.changes),
      [[{ field: 'created' }], [{ field: 'cancelled' }]],
    )
    const again = await cancel('s-planningMember')
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'REQUEST_CLOSED')
    assert.equal(await s.versions(request.id), 2)
  }),
)

test(
  '결재된 품목이 있는 요청은 취소하지 못하고(409), 없는 요청과 틀린 번호는 404이며, 본문이 있으면 400이다',
  runPurchases(async s => {
    const request = await s.made({ title: 'a', items: [ITEM, ITEM] })
    await s.decide(request.items[0]!.id, 'rejected')
    const closed = await s.api.post(`${s.base}/${request.id}/cancel`, {}, 's-planningMember')
    assert.equal(closed.status, 409)
    assert.equal(await errorOf(closed), 'REQUEST_CLOSED')
    assert.equal(await s.versions(request.id), 1)
    for (const id of [MISSING, 'not-a-uuid'])
      assert.equal(
        (await s.api.post(`${s.base}/${id}/cancel`, {}, 's-planningMember')).status,
        404,
        id,
      )
    const other = await s.api.post(`${s.base}/${request.id}/cancel`, { x: 1 }, 's-planningMember')
    assert.equal(other.status, 400)
  }),
)

test(
  '다른 학생회의 요청은 취소할 수 없다: 그 학생회 주소로는 404, 내 학생회 주소로 남의 번호를 쓰면 404',
  runPurchases(async s => {
    const mine = await s.made()
    const foreign = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: 'x', items: [ITEM] },
      'o-plain',
    )
    assert.equal(foreign.status, 201)
    const theirs = (await detailOf(foreign)).id
    const response = await s.api.post(`${s.base}/${theirs}/cancel`, {}, 's-planningMember')
    assert.equal(response.status, 404)
    assert.equal(
      (
        await s.api.post(
          `/api/organizations/${s.other.councilId}/purchase-requests/${mine.id}/cancel`,
          {},
          'o-plain',
        )
      ).status,
      404,
    )
    assert.equal(await s.versions(theirs), 1)
    assert.equal(await s.versions(mine.id), 1)
  }),
)

test(
  '응답은 알림을 기다리지 않는다: 알림 보내기가 끝나지 않아도 201이고 알림 기록은 남는다',
  runPurchases(async s => {
    const release = s.hold()
    const response = await s.api.post(s.base, { title: 'a', items: [ITEM] }, 's-planningMember')
    assert.equal(response.status, 201)
    assert.equal(await s.notices(), 1)
    release()
    await s.settled()
    assert.equal(s.calls.length, 1)
  }),
)

test(
  '스키마가 받는 가장 큰 요청(제어 문자와 한글로 채운 품목 20줄)도 413 없이 201이다',
  runPurchases(async s => {
    const control = (n: number) => ''.repeat(n)
    const body = {
      title: control(100),
      body: control(1000),
      neededBy: '2026-10-30',
      items: Array.from({ length: 20 }, () => ({
        name: control(100),
        quantity: 999,
        link: `https://a.example/${'한'.repeat(1982)}`,
        options: control(200),
      })),
    }
    assert.ok(new TextEncoder().encode(JSON.stringify(body)).length > 142_000)
    assert.equal((await s.create(body)).status, 201)
  }),
)

test(
  '지난 기수에 재정부였고 지금은 아닌 사람은 새 요청 알림을 받지 않는다',
  runPurchases(async s => {
    const { council } = s
    const president = council.people.president.memberId
    await s.db.transaction(async tx => {
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId: council.councilId,
        actor: president,
        values: { name: '2025', startsOn: '2025-01-01', endsOn: '2025-12-31' },
      })
      await createRecord(tx, {
        kind: 'department_membership',
        councilId: council.councilId,
        actor: president,
        values: {
          memberId: council.people.plain.memberId,
          departmentId: council.departments.finance,
          cohortId,
          departmentRank: null,
          startsAt: clockNow,
        },
      })
    })
    await s.made({ title: 'a', items: [ITEM] }, 's-planningMember')
    const recipients = (
      await s.pg.query<{ recipient_id: string }>('SELECT recipient_id FROM notification')
    ).rows.map(row => row.recipient_id)
    assert.deepEqual(recipients, [council.people.financeMember.memberId])
  }),
)
