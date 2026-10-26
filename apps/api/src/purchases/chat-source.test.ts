import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, ChatMessage, ExpenseDetail } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { canSeeMessage } from '../chat/photos.js'
import { clockNow, createRecord } from '../records/records.js'
import {
  detailOf,
  endpointOf,
  errorOf,
  ITEM,
  MISSING,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const PLANNING = 's-planningMember'
const JOINED = '2026-03-01T00:00:00Z'
const EXPENSE = {
  method: 'card',
  vendor: '다이소',
  description: '마커',
  amount: 15000,
  paidOn: '2026-10-25',
}

// 두 학생회의 대화방을 만들고 모두 3월에 들어온 것으로 둔다.
async function withChat(s: PurchaseKit) {
  const mine = `/api/organizations/${s.council.councilId}`
  const theirs = `/api/organizations/${s.other.councilId}`
  await s.api.get(`${mine}/rooms`, 's-president')
  await s.api.get(`${theirs}/rooms`, 'o-president')
  await s.pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const roomId = async (councilId: string, which: string) =>
    (
      await s.pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
           LEFT JOIN department d ON d.id = cr.department_id
          WHERE r.council_id = $1 AND CASE WHEN cr.type = 'department' THEN d.name
                WHEN cr.type = 'all_members' THEN 'all' ELSE cr.type END = $2`,
        [councilId, which],
      )
    ).rows[0]!.id
  const say = async (at: string, room: string, user: string) => {
    const response = await s.api.post(`${at}/rooms/${room}/messages`, { body: '사 주세요' }, user)
    assert.equal(response.status, 201)
    return ((await response.json()) as ChatMessage).id
  }
  return { mine, theirs, roomId, say }
}

const expenseOf = (s: PurchaseKit, body: unknown, user = FINANCE) =>
  s.api.post(`/api/organizations/${s.council.councilId}/expenses`, body, user)
// 요청·품목·지출·알림·연결 어느 것도 늘지 않았는지 보는 합이다.
const made = (s: PurchaseKit) =>
  s
    .count(
      `SELECT (SELECT count(*) FROM request) + (SELECT count(*) FROM line_item)
            + (SELECT count(*) FROM expense) + (SELECT count(*) FROM notification)
            + (SELECT count(*) FROM evidence_link) AS n`,
    )
    .then(Number)

test(
  '재정부가 남의 요청을 대신 낸다: 요청한 사람은 그 사람, 만든 사람과 판 1의 사람은 나, 그 사람의 내 요청에 있고 취소는 그 사람만',
  runPurchases(async s => {
    const planner = s.council.people.planningMember.memberId
    const me = s.council.people.financeMember.memberId
    const request = await s.made({ title: '현수막', items: [ITEM], requestedBy: planner }, FINANCE)
    assert.equal(request.requestedBy.id, planner)
    const row = await s.pg.query<{ created_by: string }>(
      'SELECT created_by FROM record WHERE id = $1',
      [request.id],
    )
    assert.equal(row.rows[0]!.created_by, me)
    const version = await s.pg.query<{ changed_by: string }>(
      'SELECT changed_by FROM record_version WHERE record_id = $1 AND version_no = 1',
      [request.id],
    )
    assert.equal(version.rows[0]!.changed_by, me)
    const mine = async (user: string) =>
      (
        (await (await s.api.get(`${s.base}?view=mine`, user)).json()) as {
          requests: { id: string }[]
        }
      ).requests.map(item => item.id)
    assert.deepEqual(await mine(PLANNING), [request.id])
    assert.deepEqual(await mine(FINANCE), [])
    assert.equal((await s.api.post(`${s.base}/${request.id}/cancel`, {}, FINANCE)).status, 403)
    assert.equal((await s.api.post(`${s.base}/${request.id}/cancel`, {}, PLANNING)).status, 204)
  }),
)

test(
  '결과 알림은 요청한 사람에게 가고, 새 요청 알림은 만든 사람과 요청한 사람을 뺀 재정부 부서원에게 간다',
  runPurchases(async s => {
    const planner = s.council.people.planningMember.memberId
    const root = `/api/organizations/${s.council.councilId}`
    await s.api.post(
      `${root}/fiscal-periods`,
      { name: '2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
      FINANCE,
    )
    const view = (await (
      await s.api.post(`${root}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
    ).json()) as BudgetResponse
    const request = await s.made({ title: '현수막', items: [ITEM], requestedBy: planner }, FINANCE)
    // 재정부원은 나 하나이고 내가 만들었으니 새 요청 알림이 없다. 요청한 사람에게도 없다.
    assert.equal(await s.notices(), 0)
    assert.equal(s.calls.length, 0)
    const decided = await s.api.post(
      `${s.base}/${request.id}/decisions`,
      {
        decisions: [
          {
            lineItemId: request.items[0]!.id,
            outcome: 'approved',
            amount: 10000,
            budgetItemId: view.items[0]!.id,
          },
        ],
      },
      FINANCE,
    )
    assert.equal(decided.status, 200)
    await s.settled()
    const [row] = (
      await s.pg.query<{ recipient_id: string }>(
        "SELECT recipient_id FROM notification WHERE type = 'changed' AND record_id = $1",
        [request.id],
      )
    ).rows
    assert.equal(row!.recipient_id, planner)
    assert.deepEqual(
      s.calls.map(([target]) => target.endpoint),
      [endpointOf(PLANNING)],
    )
  }),
)

test(
  '새 요청 알림: 다른 재정부원에게는 가고 만든 사람과 요청한 사람(재정부원이어도)에게는 가지 않는다',
  runPurchases(async s => {
    const me = s.council.people.financeMember.memberId
    const peer = s.council.people.plain.memberId
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'department_membership',
        councilId: s.council.councilId,
        actor: me,
        values: {
          memberId: peer,
          departmentId: s.council.departments.finance,
          cohortId: s.council.cohortId,
          departmentRank: null,
          startsAt: clockNow,
        },
      }),
    )
    const recipients = async (id: string) =>
      (
        await s.pg.query<{ recipient_id: string }>(
          'SELECT recipient_id FROM notification WHERE record_id = $1',
          [id],
        )
      ).rows.map(item => item.recipient_id)
    // 요청한 사람이 재정부원 아닌 기획부원: 다른 재정부원(peer)만 받는다.
    const first = await s.made(
      { title: 'a', items: [ITEM], requestedBy: s.council.people.planningMember.memberId },
      FINANCE,
    )
    assert.deepEqual(await recipients(first.id), [peer])
    // 요청한 사람이 다른 재정부원이면 아무도 받지 않는다(만든 사람도 뺀다).
    const second = await s.made({ title: 'b', items: [ITEM], requestedBy: peer }, FINANCE)
    assert.deepEqual(await recipients(second.id), [])
    // 재정부원이 자기 이름으로 내면 다른 재정부원이 받는다(지금과 같다).
    const own = await s.made({ title: 'c', items: [ITEM] }, FINANCE)
    assert.deepEqual(await recipients(own.id), [peer])
  }),
)

test(
  '대신 내기 권한과 사람: 재정부가 아니면 403(MEMBER_INVALID보다 먼저), 나를 주면 누구나 된다, 떠난 사람·다른 학생회 사람·없는 번호는 409 MEMBER_INVALID이고 아무것도 생기지 않는다',
  runPurchases(async s => {
    const planner = s.council.people.planningMember.memberId
    const items = [ITEM]
    for (const user of ['s-president', 's-plain', 's-planningHead'])
      assert.equal((await s.create({ title: 'a', items, requestedBy: planner }, user)).status, 403)
    assert.equal(
      (await s.create({ title: 'a', items, requestedBy: MISSING }, 's-plain')).status,
      403,
    )
    assert.equal(await made(s), 0)
    const plain = s.council.people.plain.memberId
    assert.equal((await s.create({ title: 'a', items, requestedBy: null }, 's-plain')).status, 201)
    const self = await detailOf(
      await s.create({ title: 'a', items, requestedBy: plain }, 's-plain'),
    )
    assert.equal(self.requestedBy.id, plain)
    const done = await made(s)
    for (const requestedBy of [
      s.council.people.ended.memberId,
      s.other.people.financeMember.memberId,
      MISSING,
    ]) {
      const response = await s.create({ title: 'a', items, requestedBy }, FINANCE)
      assert.equal(response.status, 409, requestedBy)
      assert.equal(await errorOf(response), 'MEMBER_INVALID')
    }
    assert.equal(await made(s), done)
  }),
)

test(
  '근거 메시지: 요청과 지출이 같은 거래에서 evidence_link 한 줄을 남기고, 주지 않으면 없으며, 응답에 싣지 않는다',
  runPurchases(async s => {
    const chat = await withChat(s)
    const messageId = await chat.say(
      chat.mine,
      await chat.roomId(s.council.councilId, 'all'),
      PLANNING,
    )
    const response = await s.create({
      title: '현수막',
      items: [
        { ...ITEM, name: '고쳐 적은 네임펜', link: 'https://www.coupang.com/vp/products/7334523' },
      ],
      requestedBy: s.council.people.planningMember.memberId,
      sourceMessageId: messageId,
    })
    assert.equal(response.status, 201)
    assert.ok(!(await response.clone().text()).includes(messageId))
    const request = await detailOf(response)
    const saved = await detailOf(await s.api.get(`${s.base}/${request.id}`, FINANCE))
    assert.equal(saved.items[0]!.name, '고쳐 적은 네임펜')
    assert.equal(saved.items[0]!.link, 'https://www.coupang.com/vp/products/7334523')
    const spent = await expenseOf(s, { ...EXPENSE, sourceMessageId: messageId })
    assert.equal(spent.status, 201)
    assert.ok(!(await spent.clone().text()).includes(messageId))
    const expense = ((await spent.json()) as { expense: ExpenseDetail }).expense
    const links = await s.pg.query<{ record_id: string; message_id: string }>(
      'SELECT record_id, message_id FROM evidence_link',
    )
    assert.deepEqual(links.rows.map(item => item.record_id).sort(), [request.id, expense.id].sort())
    assert.ok(links.rows.every(item => item.message_id === messageId))
    await s.made({ title: 'b', items: [ITEM] }, FINANCE)
    await expenseOf(s, { ...EXPENSE, sourceMessageId: null })
    assert.equal(await s.count('SELECT count(*) AS n FROM evidence_link'), 2)
  }),
)

test(
  '볼 수 없는 근거 메시지는 모두 같은 409 MESSAGE_INVALID이고 요청·품목·지출·알림·연결이 없다: 안 들어간 방, 들어오기 전, 지난 기수 공지방, 다른 학생회, 메시지가 아닌 번호, 없는 번호',
  runPurchases(async s => {
    const chat = await withChat(s)
    const mine = s.council.councilId
    const all = await chat.roomId(mine, 'all')
    const financeRoom = await chat.roomId(mine, '재정부')
    const planning = await chat.say(chat.mine, await chat.roomId(mine, '기획부'), PLANNING)
    const leadership = await chat.say(
      chat.mine,
      await chat.roomId(mine, 'leadership'),
      's-president',
    )
    // 부서방은 같은 기수여도 들어오기 전 것을 보지 않는다.
    const before = await chat.say(chat.mine, financeRoom, FINANCE)
    // 공지방은 같은 기수만 들어오기 전 것을 본다. 지난 기수 것은 막힌다.
    const pastCohort = await chat.say(chat.mine, all, 's-president')
    await s.pg.query(`UPDATE message SET sent_at = '2025-10-25T03:00:00Z' WHERE id = $1`, [
      pastCohort,
    ])
    const theirAll = await chat.roomId(s.other.councilId, 'all')
    const theirs = await chat.say(chat.theirs, theirAll, 'o-president')
    // 거르기를 지웠을 때 통과하도록 내 재정부원이 그 방의 참여 줄도 가지고, 두 메시지는 같은 시각이다.
    await s.pg.query(
      'INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1, $2, $3)',
      [theirAll, s.council.people.financeMember.memberId, JOINED],
    )
    await s.pg.query(
      `UPDATE message SET sent_at = (SELECT sent_at FROM message WHERE id = $1) WHERE id = $2`,
      [before, theirs],
    )
    await s.pg.query(
      `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id = $1) + interval '1 microsecond'
        WHERE member_id = $2 AND room_id = $3`,
      [before, s.council.people.financeMember.memberId, financeRoom],
    )
    const accountLike = s.council.people.plain.memberId
    const done = await made(s)
    const hidden = [planning, leadership, before, pastCohort, theirs, accountLike, MISSING]
    for (const sourceMessageId of hidden) {
      const asRequest = await s.create({ title: 'a', items: [ITEM], sourceMessageId }, FINANCE)
      assert.equal(asRequest.status, 409, sourceMessageId)
      assert.equal(await errorOf(asRequest), 'MESSAGE_INVALID')
      const asExpense = await expenseOf(s, { ...EXPENSE, sourceMessageId })
      assert.equal(asExpense.status, 409, sourceMessageId)
      assert.equal(await errorOf(asExpense), 'MESSAGE_INVALID')
    }
    assert.equal(await made(s), done)
    assert.equal(s.calls.length, 0)
    // 근거 잇기가 한 번 더 막아 주므로, 보는 조건의 학생회 거르기는 따로 본다.
    const now = new Date('2026-10-25T03:00:00Z')
    const actor = await actorOf(s.db, FINANCE, s.council.councilId, now)
    assert.equal(await canSeeMessage(s.db, actor!, theirs), false)
    assert.equal(await canSeeMessage(s.db, actor!, planning), false)
  }),
)

test(
  '부서방은 들어온 시각과 같은 시각의 메시지는 되고 1마이크로초 앞은 안 되며, 공지방은 같은 기수면 들어오기 전이어도 된다',
  runPurchases(async s => {
    const chat = await withChat(s)
    const all = await chat.roomId(s.council.councilId, 'all')
    const financeRoom = await chat.roomId(s.council.councilId, '재정부')
    const inFinance = await chat.say(chat.mine, financeRoom, FINANCE)
    const messageId = await chat.say(chat.mine, all, 's-president')
    const me = s.council.people.financeMember.memberId
    const joinAt = (offset: string, id: string, room: string) =>
      s.pg.query(
        `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id = $1) ${offset}
          WHERE member_id = $2 AND room_id = $3`,
        [id, me, room],
      )
    const fromFinance = { title: 'a', items: [ITEM], sourceMessageId: inFinance }
    await joinAt('', inFinance, financeRoom)
    assert.equal((await s.create(fromFinance, FINANCE)).status, 201)
    await joinAt("+ interval '1 microsecond'", inFinance, financeRoom)
    assert.equal(await errorOf(await s.create(fromFinance, FINANCE)), 'MESSAGE_INVALID')
    const body = { title: 'a', items: [ITEM], sourceMessageId: messageId }
    await joinAt("+ interval '1 microsecond'", messageId, all)
    assert.equal((await s.create(body, FINANCE)).status, 201)
    await s.pg.query(`UPDATE message SET sent_at = '2025-10-25T03:00:00Z' WHERE id = $1`, [
      messageId,
    ])
    assert.equal(await errorOf(await s.create(body, FINANCE)), 'MESSAGE_INVALID')
  }),
)

test(
  '입력 경우: requestedBy와 sourceMessageId와 taskId가 빈 값·공백·상한 초과·NUL·홀로 쓰인 서러게이트·uuid 아님이면 400이고 아무것도 생기지 않는다. 지출도 같다',
  runPurchases(async s => {
    const bad: unknown[] = [
      '',
      '   ',
      'a'.repeat(37),
      '😀'.repeat(37),
      `${MISSING}\u0000`,
      `${MISSING}\uD800`,
      'not-a-uuid',
      7,
    ]
    for (const value of bad) {
      for (const key of ['requestedBy', 'sourceMessageId', 'taskId'])
        assert.equal(
          (await s.create({ title: 'a', items: [ITEM], [key]: value }, FINANCE)).status,
          400,
          `${key} ${JSON.stringify(value)}`,
        )
      assert.equal((await expenseOf(s, { ...EXPENSE, sourceMessageId: value })).status, 400)
    }
    assert.equal((await s.create({ title: 'a', items: [ITEM], extra: 1 }, FINANCE)).status, 400)
    assert.equal((await s.create({ title: 'a', items: [ITEM] }, '')).status, 401)
    assert.equal(await made(s), 0)
  }),
)
