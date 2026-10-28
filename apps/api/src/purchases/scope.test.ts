import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseRequestsResponse } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { ITEM, MISSING, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const list = async (s: PurchaseKit, query: string, user = 's-president') => {
  const response = await s.api.get(`${s.base}?${query}`, user)
  assert.equal(response.status, 200, `${user}: ${query}`)
  return (await response.json()) as PurchaseRequestsResponse
}
const titles = async (s: PurchaseKit, query: string, user?: string) =>
  (await list(s, query, user)).requests.map(row => row.title)
const event = (s: PurchaseKit, foreign = false) => {
  const council = foreign ? s.other : s.council
  return s.db.transaction(tx =>
    createRecord(tx, {
      kind: 'event',
      councilId: council.councilId,
      actor: council.people.president.memberId,
      values: { name: '축제', startsAt: new Date('2026-10-25T03:00:00Z') },
    }),
  )
}

test(
  '상시·행사 범위는 목록 상한 전에 거르고 부서 보기에도 같은 범위를 쓴다',
  runPurchases(async s => {
    const id = await event(s)
    await s.made({ title: '상시', items: [ITEM] })
    await s.pg.query(
      `WITH ids AS MATERIALIZED (SELECT uuidv7() AS rid, uuidv7() AS iid FROM generate_series(1, 101)),
    r AS (INSERT INTO record (id, kind, council_id) SELECT rid, 'request', $1::uuid FROM ids),
    i AS (INSERT INTO record (id, kind, council_id) SELECT iid, 'line_item', $1::uuid FROM ids),
    q AS (INSERT INTO request (id, type, title, requested_by, event_id) SELECT rid, 'purchase', '행사', $2::uuid, $3::uuid FROM ids)
    INSERT INTO line_item (id, request_id, name, quantity) SELECT iid, rid, '품목', 1 FROM ids`,
      [s.council.councilId, s.council.people.plain.memberId, id],
    )
    assert.deepEqual(await titles(s, 'view=all&event=none'), ['상시'])
    assert.equal((await list(s, 'view=all&event=none')).truncated, false)
    assert.equal((await list(s, `view=all&event=${id}`)).requests.length, 100)
    assert.deepEqual(await titles(s, 'view=department&event=none', 's-planningHead'), ['상시'])
    assert.deepEqual(await titles(s, 'view=mine&event=none', 's-planningMember'), ['상시'])
    assert.deepEqual(await titles(s, 'view=all&event=none', 's-planningMember'), ['상시'])
    assert.deepEqual(await titles(s, 'view=pending&event=none', 's-financeMember'), ['상시'])
  }),
)

test(
  '부원도 학생회 안의 전체·결재 대기와 상세를 읽고 내 요청·내 부서는 목록만 거른다',
  runPurchases(async s => {
    const id = await event(s)
    const own = await s.made({ title: '내 상시', items: [ITEM] }, 's-planningMember')
    await s.made({ title: '내 행사', eventId: id, items: [ITEM] }, 's-planningMember')
    const other = await s.made({ title: '남의 상시', items: [ITEM] }, 's-plain')
    await s.made({ title: '남의 행사', eventId: id, items: [ITEM] }, 's-plain')
    for (const user of ['s-planningMember', 's-plain']) {
      for (const view of ['all', 'pending']) {
        assert.deepEqual((await titles(s, `view=${view}`, user)).sort(), [
          '남의 상시',
          '남의 행사',
          '내 상시',
          '내 행사',
        ])
        assert.deepEqual((await titles(s, `view=${view}&event=none`, user)).sort(), [
          '남의 상시',
          '내 상시',
        ])
        assert.deepEqual((await titles(s, `view=${view}&event=${id}`, user)).sort(), [
          '남의 행사',
          '내 행사',
        ])
      }
      for (const request of [own, other])
        assert.equal((await s.api.get(`${s.base}/${request.id}`, user)).status, 200)
    }
    for (const view of ['department', 'mine']) {
      assert.deepEqual((await titles(s, `view=${view}`, 's-planningMember')).sort(), [
        '내 상시',
        '내 행사',
      ])
      assert.deepEqual(await titles(s, `view=${view}&event=none`, 's-planningMember'), ['내 상시'])
      assert.deepEqual(await titles(s, `view=${view}&event=${id}`, 's-planningMember'), ['내 행사'])
    }
    for (const user of [
      's-president',
      's-vicePresident',
      's-financeMember',
      's-planningHead',
      's-planningViceHead',
    ])
      assert.equal((await list(s, 'view=all', user)).requests.length, 4, user)
  }),
)

test(
  '범위는 학생회 경계를 넘지 않고 다른 학생회 행사와 없는 행사는 404다',
  runPurchases(async s => {
    const foreignEvent = await event(s, true)
    await s.made({ title: '우리 상시', items: [ITEM] })
    await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: '다른 학생회', items: [ITEM] },
      'o-plain',
    )
    assert.deepEqual(await titles(s, 'view=all&event=none'), ['우리 상시'])
    for (const view of ['all', 'mine', 'pending', 'department'])
      for (const id of [foreignEvent, MISSING])
        assert.equal(
          (await s.api.get(`${s.base}?view=${view}&event=${id}`, 's-president')).status,
          404,
        )
    assert.equal((await s.api.get(`${s.base}?view=all&event=none`, 'o-president')).status, 403)
    assert.deepEqual(await titles(s, 'view=all&event=none', 's-plain'), ['우리 상시'])
    assert.equal((await s.api.get(`${s.base}?view=all&event=none`)).status, 401)
    for (const query of ['event=', 'event=NONE', 'event=none&event=none', 'event=not-a-uuid'])
      assert.equal(
        (await s.api.get(`${s.base}?view=all&${query}`, 's-president')).status,
        400,
        query,
      )
  }),
)
