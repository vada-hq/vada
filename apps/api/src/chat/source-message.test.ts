import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { ChatMessage, ExpenseDetail } from '@vada/contracts'
import { errorOf, ITEM, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const PLANNING = 's-planningMember'
const JOINED = '2026-03-01T00:00:00Z'
const EXPENSE = {
  vendor: '다이소',
  description: '마커',
  amount: 15000,
  paidOn: '2026-10-25',
  method: 'card',
}

// 내 학생회 공지방에 기획부원이 보낸 메시지 하나. 모두 3월에 들어온 것으로 둔다.
async function sourceOf(s: PurchaseKit) {
  const mine = `/api/organizations/${s.council.councilId}`
  await s.api.get(`${mine}/rooms`, 's-president')
  await s.pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const { rows } = await s.pg.query<{ id: string }>(
    `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
      WHERE r.council_id = $1 AND cr.type = 'all_members'`,
    [s.council.councilId],
  )
  const response = await s.api.post(
    `${mine}/rooms/${rows[0]!.id}/messages`,
    { body: '마커 사 주세요' },
    PLANNING,
  )
  assert.equal(response.status, 201)
  return ((await response.json()) as ChatMessage).id
}

const spend = (s: PurchaseKit, sourceMessageId: string | null) =>
  s.api.post(
    `/api/organizations/${s.council.councilId}/expenses`,
    { ...EXPENSE, commandId: randomUUID(), sourceMessageId },
    FINANCE,
  )
const spent = async (s: PurchaseKit, sourceMessageId: string | null) => {
  const response = await spend(s, sourceMessageId)
  assert.equal(response.status, 201)
  return ((await response.json()) as { expense: ExpenseDetail }).expense
}
// 요청·품목·지출·결제 내역·알림·연결 어느 것도 늘지 않았는지 보는 합이다.
const total = (s: PurchaseKit) =>
  s.count(
    `SELECT (SELECT count(*) FROM request) + (SELECT count(*) FROM line_item)
          + (SELECT count(*) FROM expense) + (SELECT count(*) FROM payment_line)
          + (SELECT count(*) FROM notification) + (SELECT count(*) FROM evidence_link)
          + (SELECT count(*) FROM record) AS n`,
  )
const asSource = (sourceMessageId: string, title = '마커') => ({
  title,
  items: [ITEM],
  sourceMessageId,
})

test(
  '같은 메시지로 살아 있는 요청이 있으면 새 요청은 409 SOURCE_MESSAGE_USED이고 아무것도 남지 않는다. 다른 사람이 내도 같다',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    await s.made(asSource(messageId), PLANNING)
    const before = await total(s)
    for (const user of [PLANNING, FINANCE, 's-president']) {
      const again = await s.create(asSource(messageId, '다시'), user)
      assert.equal(again.status, 409, user)
      assert.equal(await errorOf(again), 'SOURCE_MESSAGE_USED')
    }
    assert.equal(await total(s), before)
  }),
)

test(
  '요청이 취소되면 같은 메시지로 새 요청이 되고, 반려되면 또 되며, 대기·승인·일부 반려인 요청은 막는다',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    const blocked = async () => errorOf(await s.create(asSource(messageId), PLANNING))
    const first = await s.made(asSource(messageId), PLANNING)
    assert.equal((await s.api.post(`${s.base}/${first.id}/cancel`, {}, PLANNING)).status, 204)
    // 취소한 요청은 막지 않는다.
    const second = await s.made(
      { ...asSource(messageId), items: [ITEM, { ...ITEM, name: '지우개' }] },
      PLANNING,
    )
    // 품목 하나만 반려하면 다른 품목이 대기라 아직 막는다.
    await s.decide(second.items[0]!.id, 'rejected')
    assert.equal(await blocked(), 'SOURCE_MESSAGE_USED')
    // 하나는 반려, 하나는 승인이면 일부 승인이라 막는다.
    await s.decide(second.items[1]!.id, 'approved')
    assert.equal(await blocked(), 'SOURCE_MESSAGE_USED')
    // 승인한 품목을 취소하면 반려 하나와 취소 하나라 승인이 없어 요청이 반려다.
    await s.decide(second.items[1]!.id, 'cancelled')
    const third = await s.made(asSource(messageId), PLANNING)
    // 모든 품목이 반려된 요청도 막지 않는다.
    await s.decide(third.items[0]!.id, 'rejected')
    const fourth = await s.made(asSource(messageId), PLANNING)
    await s.decide(fourth.items[0]!.id, 'approved')
    assert.equal(await blocked(), 'SOURCE_MESSAGE_USED')
    // 모든 품목의 승인을 취소해 상태가 취소인 요청도 막지 않는다.
    await s.decide(fourth.items[0]!.id, 'cancelled')
    await s.made(asSource(messageId), PLANNING)
    assert.equal(await blocked(), 'SOURCE_MESSAGE_USED')
  }),
)

test(
  '같은 메시지로 취소되지 않은 지출이 있으면 새 지출은 409 SOURCE_MESSAGE_USED이고 아무것도 남지 않으며, 취소하면 다시 된다',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    const first = await spent(s, messageId)
    const before = await total(s)
    const again = await spend(s, messageId)
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'SOURCE_MESSAGE_USED')
    assert.equal(await total(s), before)
    const cancel = await s.api.post(
      `/api/organizations/${s.council.councilId}/expenses/${first.id}/cancel`,
      { reason: '잘못 적음' },
      FINANCE,
    )
    assert.equal(cancel.status, 200)
    await spent(s, messageId)
    assert.equal(await errorOf(await spend(s, messageId)), 'SOURCE_MESSAGE_USED')
  }),
)

test(
  '요청과 지출은 서로 막지 않는다: 요청이 있는 메시지로 지출이, 지출이 있는 메시지로 요청이 된다',
  runPurchases(async s => {
    const requested = await sourceOf(s)
    await s.made(asSource(requested), PLANNING)
    await spent(s, requested)
    const paid = await sourceOf(s)
    await spent(s, paid)
    await s.made(asSource(paid), PLANNING)
    assert.equal(await s.count('SELECT count(*) AS n FROM evidence_link'), 4)
  }),
)

test(
  '근거 없이 만드는 요청과 지출은 그대로 몇 번이든 된다',
  runPurchases(async s => {
    await sourceOf(s)
    for (let index = 0; index < 2; index++) {
      assert.equal((await s.create({ title: '마커', items: [ITEM] }, PLANNING)).status, 201)
      await spent(s, null)
    }
  }),
)

test(
  '볼 수 없는 메시지는 쓰인 메시지여도 SOURCE_MESSAGE_USED가 아니라 MESSAGE_INVALID다(있는지 드러내지 않는다)',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    await s.made(asSource(messageId), PLANNING)
    // 지난 기수의 공지방 메시지는 볼 수 없다.
    await s.pg.query(`UPDATE message SET sent_at = '2025-10-25T03:00:00Z' WHERE id = $1`, [
      messageId,
    ])
    assert.equal(await errorOf(await s.create(asSource(messageId), FINANCE)), 'MESSAGE_INVALID')
    assert.equal(await errorOf(await spend(s, messageId)), 'MESSAGE_INVALID')
  }),
)

test(
  '방 참여를 잃으면 이미 기록이 있는 원문으로도 요청·지출을 만들 수 없고 중복 여부를 숨긴다',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    await s.made(asSource(messageId), PLANNING)
    await s.pg.query('DELETE FROM room_membership WHERE member_id = $1', [
      s.council.people.financeMember.memberId,
    ])
    assert.equal(await errorOf(await s.create(asSource(messageId), FINANCE)), 'MESSAGE_INVALID')
    assert.equal(await errorOf(await spend(s, messageId)), 'MESSAGE_INVALID')
  }),
)

test(
  '다른 학생회 기록이 잘못 연결되어 있어도 중복 검사와 응답에 영향을 주지 않는다',
  runPurchases(async s => {
    const messageId = await sourceOf(s)
    const otherBase = `/api/organizations/${s.other.councilId}`
    const otherRequest = await s.api.post(
      `${otherBase}/purchase-requests`,
      { title: '남의 요청', items: [ITEM] },
      'o-planningMember',
    )
    assert.equal(otherRequest.status, 201)
    const requestId = ((await otherRequest.json()) as { request: { id: string } }).request.id
    const otherExpense = await s.api.post(
      `${otherBase}/expenses`,
      { ...EXPENSE, commandId: randomUUID() },
      'o-financeMember',
    )
    assert.equal(otherExpense.status, 201)
    const expenseId = ((await otherExpense.json()) as { expense: { id: string } }).expense.id
    await s.pg.query(
      'INSERT INTO evidence_link (record_id, message_id) VALUES ($1, $3), ($2, $3)',
      [requestId, expenseId, messageId],
    )
    await s.made(asSource(messageId), PLANNING)
    await spent(s, messageId)
  }),
)
