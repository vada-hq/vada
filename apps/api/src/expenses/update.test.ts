import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse } from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 재정부가 지출의 사유와 행사를 고친다(POST expenses/:expenseId, 조각 5).

const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'
const DAY = (value: string) => new Date(`${value}:00Z`)
const NO_SUCH = '01a164e0-8f14-7fff-b9d9-fc48438f6ee9'

const post = (t: SettlementKit, id: string, body: unknown, user = FINANCE) =>
  t.api.post(`/api/organizations/${t.council.councilId}/expenses/${id}`, body, user)
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const detailOf = async (response: Response) => ((await response.json()) as ExpenseResponse).expense
const versions = async (t: SettlementKit, id: string) =>
  (await t.pg.query('SELECT count(*)::int AS n FROM record_version WHERE record_id = $1', [id]))
    .rows[0] as { n: number }

test(
  '사유와 행사를 고친다: 판이 하나 늘고 이력에 바뀐 칸이 보이고, 같은 값이나 칸을 뺀 요청은 판을 늘리지 않는다',
  withSettlement(async t => {
    const first = await t.event({ name: '봄 축제' })
    const second = await t.event({ name: '가을 축제' })
    const id = await t.expense({ eventId: first, reason: '준비' })
    const moved = await post(t, id, { reason: '행사 준비물', eventId: second })
    assert.equal(moved.status, 200)
    const detail = await detailOf(moved)
    assert.equal(detail.reason, '행사 준비물')
    assert.deepEqual(detail.event, { id: second, name: '가을 축제' })
    assert.deepEqual(
      detail.history.map(version => version.changes),
      [[{ field: 'created' }], [{ field: 'reason' }, { field: 'event' }]],
    )
    assert.equal((await versions(t, id)).n, 2)
    for (const body of [
      { reason: '행사 준비물', eventId: second },
      { reason: '행사 준비물' },
      { eventId: second },
    ]) {
      assert.equal((await post(t, id, body)).status, 200)
      assert.equal((await versions(t, id)).n, 2, JSON.stringify(body))
    }
    const reason = await detailOf(await post(t, id, { reason: null }))
    assert.equal(reason.reason, null)
    assert.deepEqual(reason.history.at(-1)?.changes, [{ field: 'reason' }])
    const cleared = await detailOf(await post(t, id, { eventId: null }))
    assert.equal(cleared.event, null)
    assert.deepEqual(cleared.history.at(-1)?.changes, [{ field: 'event' }])
    assert.equal((await versions(t, id)).n, 4)
  }),
)

test(
  '재정부만 고친다: 회장단과 부서원은 403이고 그 응답이 행사나 지출의 상태를 드러내지 않는다',
  withSettlement(async t => {
    const done = await t.event()
    await t.completion(done, 'completed', DAY('2026-10-24T03:00'))
    const id = await t.expense({ eventId: done })
    for (const user of [PRESIDENT, 's-planningMember', 's-plain']) {
      assert.equal((await post(t, id, { reason: 'x' }, user)).status, 403, user)
    }
    const anonymous = await t.api.post(`/api/organizations/${t.council.councilId}/expenses/${id}`, {
      reason: 'x',
    })
    assert.equal(anonymous.status, 401)
  }),
)

test(
  '입력 검사: 빈 본문, 모르는 키, 사유 상한+1(이모지), NUL, 행사 번호 아님은 400이고 없는 지출은 404다',
  withSettlement(async t => {
    const id = await t.expense({})
    const bad: [string, unknown][] = [
      ['빈 본문', {}],
      ['모르는 키', { reason: 'x', amount: 1 }],
      ['사유 1001자', { reason: '😀'.repeat(1001) }],
      ['사유 공백만', { reason: '  ' }],
      ['사유 NUL', { reason: 'a\u0000' }],
      ['사유 서러게이트', { reason: 'a\uD800' }],
      ['행사 번호 아님', { eventId: 'x' }],
    ]
    for (const [label, body] of bad) {
      const response = await post(t, id, body)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal((await post(t, id, { reason: '😀'.repeat(1000) })).status, 200)
    assert.equal((await post(t, NO_SUCH, { reason: 'x' })).status, 404)
    const theirs = await t.expense({}, t.other)
    assert.equal((await post(t, theirs, { reason: 'x' })).status, 404)
    assert.equal((await versions(t, theirs)).n, 1)
  }),
)

test(
  '다른 학생회 행사로는 옮길 수 없다: 409 EVENT_INVALID이고 지출은 그대로다',
  withSettlement(async t => {
    const mine = await t.event()
    const theirs = await t.event({}, t.other)
    // 다른 학생회의 완료한 행사여도 EVENT_COMPLETED가 아니라 EVENT_INVALID다(잠금 확인이 뒤).
    await t.completionOfOther(theirs)
    const id = await t.expense({ eventId: mine })
    for (const eventId of [theirs, NO_SUCH]) {
      const response = await post(t, id, { eventId })
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'EVENT_INVALID')
    }
    assert.equal((await versions(t, id)).n, 1)
  }),
)

test(
  '완료한 행사: 바꾸기 전 행사도 옮길 행사도 완료 전이어야 한다(EVENT_COMPLETED), 취소한 지출은 EXPENSE_CANCELLED',
  withSettlement(async t => {
    const open = await t.event()
    const done = await t.event()
    await t.completion(done, 'completed', DAY('2026-10-24T03:00'))
    const inDone = await t.expense({ eventId: done })
    const inOpen = await t.expense({ eventId: open })
    const loose = await t.expense({})
    for (const [id, body] of [
      [inDone, { reason: '고침' }],
      [inDone, { eventId: open }],
      [inDone, { eventId: null }],
      [inOpen, { eventId: done }],
      [loose, { eventId: done }],
    ] as const) {
      const response = await post(t, id, body)
      assert.equal(response.status, 409, JSON.stringify(body))
      assert.equal(await errorOf(response), 'EVENT_COMPLETED', JSON.stringify(body))
      assert.equal((await versions(t, id)).n, 1)
    }
    assert.equal((await post(t, inOpen, { reason: '고침' })).status, 200)
    assert.equal((await post(t, loose, { eventId: open })).status, 200)
    await t.completion(done, 'completion_cancelled', DAY('2026-10-24T04:00'), '되돌림')
    assert.equal((await post(t, inDone, { eventId: open })).status, 200)
    const cancelled = await t.expense({ eventId: open })
    const cancel = await t.api.post(
      `/api/organizations/${t.council.councilId}/expenses/${cancelled}/cancel`,
      { reason: '잘못' },
      FINANCE,
    )
    assert.equal(cancel.status, 200)
    const response = await post(t, cancelled, { reason: '고침' })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EXPENSE_CANCELLED')
  }),
)

test(
  '결제 내역이 있는 지출의 행사는 요청의 행사로만 바꾼다: 다르게 바꾸거나 비우면 409 EVENT_MISMATCH, 사유는 고칠 수 있다',
  withSettlement(async t => {
    const first = await t.event()
    const second = await t.event()
    const item = await t.requestWithItem(first)
    await t.approve(item.line)
    const id = await t.expense({ eventId: first })
    await t.pay(id, item.line)
    for (const eventId of [second, null]) {
      const response = await post(t, id, { eventId })
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'EVENT_MISMATCH')
    }
    assert.equal((await versions(t, id)).n, 1)
    assert.equal((await post(t, id, { eventId: first, reason: '고침' })).status, 200)
    // 요청에 행사가 없으면 묶이지 않는다.
    const free = await t.requestWithItem(null)
    await t.approve(free.line)
    const other = await t.expense({})
    await t.pay(other, free.line)
    assert.equal((await post(t, other, { eventId: second })).status, 200)
  }),
)

test(
  '예산 항목을 고른 지출은 그 항목의 행사 밖으로 옮길 수 없다: 409 EVENT_MISMATCH이고 지출은 그대로다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const first = await t.event()
    const second = await t.event()
    const item = await t.budgetItem(budget, { eventId: first })
    const id = await t.expense({ eventId: first, budgetItemId: item })
    const response = await post(t, id, { eventId: second })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EVENT_MISMATCH')
    assert.equal((await versions(t, id)).n, 1)
    assert.equal((await post(t, id, { eventId: first, reason: '고침' })).status, 200)
  }),
)
