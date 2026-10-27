import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { ChatMessage, ExpenseDetail, MessagePageResponse } from '@vada/contracts'
import { eraseMessages, ERASED_BY_REQUEST } from './erase.js'
import { ITEM, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const PLANNING = 's-planningMember'
const JOINED = '2026-03-01T00:00:00Z'
const EXPENSE = { vendor: '다이소', amount: 15000, paidOn: '2026-10-25', method: 'card' }

// 두 학생회의 공지방에 같은 모양의 메시지를 하나씩 둔다.
async function scene(s: PurchaseKit) {
  const at = (councilId: string) => `/api/organizations/${councilId}`
  await s.api.get(`${at(s.council.councilId)}/rooms`, 's-president')
  await s.api.get(`${at(s.other.councilId)}/rooms`, 'o-president')
  await s.pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const noticeRoom = async (councilId: string) =>
    (
      await s.pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.type = 'all_members'`,
        [councilId],
      )
    ).rows[0]!.id
  const mine = await noticeRoom(s.council.councilId)
  const theirs = await noticeRoom(s.other.councilId)
  const say = async (councilId: string, room: string, user: string) => {
    const response = await s.api.post(
      `${at(councilId)}/rooms/${room}/messages`,
      { body: '사 주세요' },
      user,
    )
    assert.equal(response.status, 201)
    return (await response.json()) as ChatMessage
  }
  const page = async (councilId: string, room: string, user: string) => {
    const response = await s.api.get(`${at(councilId)}/rooms/${room}/messages`, user)
    assert.equal(response.status, 200)
    return ((await response.json()) as MessagePageResponse).messages
  }
  const spent = async (councilId: string, body: object, user: string) => {
    const response = await s.api.post(
      `${at(councilId)}/expenses`,
      { ...EXPENSE, commandId: randomUUID(), ...body },
      user,
    )
    assert.equal(response.status, 201)
    return ((await response.json()) as { expense: ExpenseDetail }).expense
  }
  return { mine, theirs, say, page, spent }
}

const madeOn = (messages: ChatMessage[], id: string) =>
  messages.find(message => message.id === id)?.made

test(
  '메시지에서 만든 요청과 지출이 그 방의 메시지 응답에 만든 차례로 실리고, 만든 사람이 아닌 운영진도 보며, 다른 메시지와 보낸 직후 응답은 빈 목록이다',
  runPurchases(async s => {
    const { mine, say, page, spent } = await scene(s)
    const sent = await say(s.council.councilId, mine, PLANNING)
    assert.deepEqual(sent.made, [])
    const plain = await say(s.council.councilId, mine, PLANNING)
    const request = await s.made(
      { title: '마커 사기', items: [ITEM], sourceMessageId: sent.id },
      PLANNING,
    )
    const expense = await spent(
      s.council.councilId,
      { description: '마커 값', sourceMessageId: sent.id },
      FINANCE,
    )
    const expected = [
      { kind: 'purchase_request', id: request.id, title: '마커 사기', blocking: true },
      { kind: 'expense', id: expense.id, title: '마커 값', blocking: true },
    ]
    for (const user of [PLANNING, FINANCE, 's-president', 's-plain']) {
      const messages = await page(s.council.councilId, mine, user)
      assert.deepEqual(madeOn(messages, sent.id), expected, user)
      assert.deepEqual(madeOn(messages, plain.id), [], user)
    }
  }),
)

test(
  '취소한 요청과 지출도 그 메시지에서 만든 기록이라 남되 새 기록을 막지 않고, 반려된 요청도 막지 않는다',
  runPurchases(async s => {
    const { mine, say, page, spent } = await scene(s)
    const sent = await say(s.council.councilId, mine, PLANNING)
    const request = await s.made(
      { title: '마커', items: [ITEM], sourceMessageId: sent.id },
      PLANNING,
    )
    await s.api.post(`${s.base}/${request.id}/cancel`, {}, PLANNING)
    const expense = await spent(
      s.council.councilId,
      { description: '값', sourceMessageId: sent.id },
      FINANCE,
    )
    await s.api.post(
      `/api/organizations/${s.council.councilId}/expenses/${expense.id}/cancel`,
      { reason: '잘못 적음' },
      FINANCE,
    )
    const rejected = await s.made(
      { title: '펜', items: [ITEM], sourceMessageId: sent.id },
      PLANNING,
    )
    await s.decide(rejected.items[0]!.id, 'rejected')
    const made = madeOn(await page(s.council.councilId, mine, 's-plain'), sent.id)
    assert.deepEqual(
      made?.map(item => [item.id, item.blocking]),
      [
        [request.id, false],
        [expense.id, false],
        [rejected.id, false],
      ],
    )
  }),
)

test(
  '학생회 격리: 다른 학생회의 같은 모양 요청·지출이 내 메시지에 이어져 있어도 내 응답에 없고, 그 학생회 사람도 자기 것만 본다',
  runPurchases(async s => {
    const { mine, theirs, say, page, spent } = await scene(s)
    const my = await say(s.council.councilId, mine, PLANNING)
    const their = await say(s.other.councilId, theirs, 'o-planningMember')
    const ownRequest = await s.made(
      { title: '내 것', items: [ITEM], sourceMessageId: my.id },
      PLANNING,
    )
    const otherBase = `/api/organizations/${s.other.councilId}/purchase-requests`
    const created = await s.api.post(
      otherBase,
      { title: '남의 것', items: [ITEM], sourceMessageId: their.id },
      'o-planningMember',
    )
    assert.equal(created.status, 201)
    const otherRequest = ((await created.json()) as { request: { id: string } }).request
    const otherExpense = await spent(
      s.other.councilId,
      { description: '남의 값', sourceMessageId: their.id },
      'o-financeMember',
    )
    // 근거 잇기가 막는 연결을 직접 넣는다: 학생회 거르기를 지우면 이 시험이 실패한다.
    await s.pg.query(
      'INSERT INTO evidence_link (record_id, message_id) VALUES ($1, $3), ($2, $3)',
      [otherRequest.id, otherExpense.id, my.id],
    )
    await s.pg.query('INSERT INTO evidence_link (record_id, message_id) VALUES ($1, $2)', [
      ownRequest.id,
      their.id,
    ])
    assert.deepEqual(madeOn(await page(s.council.councilId, mine, 's-plain'), my.id), [
      { kind: 'purchase_request', id: ownRequest.id, title: '내 것', blocking: true },
    ])
    assert.deepEqual(
      madeOn(await page(s.other.councilId, theirs, 'o-plain'), their.id)?.map(item => item.id),
      [otherRequest.id, otherExpense.id],
    )
    // 다른 학생회 사람은 내 방 자체를 읽지 못한다.
    const outsider = await s.api.get(
      `/api/organizations/${s.council.councilId}/rooms/${mine}/messages`,
      'o-plain',
    )
    assert.equal(outsider.status, 403)
  }),
)

test(
  '원문을 지워도 연결된 기록은 남고, 방 참여를 잃으면 그 목록 자체를 읽지 못한다',
  runPurchases(async s => {
    const { mine, say, page } = await scene(s)
    const sent = await say(s.council.councilId, mine, PLANNING)
    const request = await s.made(
      { title: '마커', items: [ITEM], sourceMessageId: sent.id },
      PLANNING,
    )
    await s.db.transaction(tx =>
      eraseMessages(tx, [sent.id], { actor: null, reason: ERASED_BY_REQUEST }),
    )
    const erased = (await page(s.council.councilId, mine, 's-plain')).find(
      item => item.id === sent.id,
    )!
    assert.equal(erased.body, null)
    assert.deepEqual(erased.photos, [])
    assert.deepEqual(erased.made, [
      { kind: 'purchase_request', id: request.id, title: '마커', blocking: true },
    ])
    await s.pg.query('DELETE FROM room_membership WHERE room_id = $1 AND member_id = $2', [
      mine,
      s.council.people.plain.memberId,
    ])
    const hidden = await s.api.get(
      `/api/organizations/${s.council.councilId}/rooms/${mine}/messages`,
      's-plain',
    )
    assert.equal(hidden.status, 403)
    assert.equal((await hidden.text()).includes(request.id), false)
  }),
)
