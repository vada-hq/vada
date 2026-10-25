import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { ChatMessage, ExpenseDetail } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import {
  errorOf,
  ITEM,
  MISSING,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

// 지출 다시 보내기(기능 017, DEC-84, RULE-45): 같은 명령 번호의 재전송은 처음 지출의 지금 상세를 주고 아무것도 늘리지 않는다.

const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'
const BODY = { vendor: '다이소', description: '마커 구입', amount: 15000, paidOn: '2026-10-25' }

const urlOf = (councilId: string) => `/api/organizations/${councilId}/expenses`
const send = (s: PurchaseKit, body: object, user = FINANCE, councilId = s.council.councilId) =>
  s.api.post(urlOf(councilId), body, user)
const detailOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
const receipts = (s: PurchaseKit) => s.count('SELECT count(*) AS n FROM command_receipt')
// 지출·결제 내역·결재 기록·판·근거 연결·증빙 어느 것도 늘지 않았는지 보는 모양이다.
const shapeOf = (s: PurchaseKit) =>
  Promise.all(
    ['record', 'record_version', 'expense', 'payment_line', 'approval', 'evidence_link'].map(
      table => s.count(`SELECT count(*) AS n FROM ${table}`),
    ),
  )
const budgetOf = async (s: PurchaseKit) =>
  (await s.api.get(`/api/organizations/${s.council.councilId}/budget`, FINANCE)).text()

// 승인된 품목 둘과 예산 항목 하나, 대화방 메시지 하나를 둔다.
async function prepare(s: PurchaseKit) {
  const root = `/api/organizations/${s.council.councilId}`
  await s.api.post(
    `${root}/fiscal-periods`,
    { name: '2026 2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
    FINANCE,
  )
  const view = (await (
    await s.api.post(`${root}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
  ).json()) as { items: { id: string }[] }
  const request = await s.made({ title: '마커', items: [ITEM, { name: '자석', quantity: 2 }] })
  const [first, second] = request.items.map(item => item.id) as [string, string]
  await s.decide(first, 'approved')
  await s.decide(second, 'approved')
  await s.api.get(`${root}/rooms`, PRESIDENT)
  await s.pg.query("UPDATE room_membership SET joined_at = '2026-03-01T00:00:00Z'")
  const room = (
    await s.pg.query<{ id: string }>(
      `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
        WHERE r.council_id = $1 AND cr.type = 'all_members'`,
      [s.council.councilId],
    )
  ).rows[0]!.id
  const said = await s.api.post(`${root}/rooms/${room}/messages`, { body: '사 주세요' }, PRESIDENT)
  assert.equal(said.status, 201)
  const messageId = ((await said.json()) as ChatMessage).id
  return { first, second, budgetItemId: view.items[0]!.id, messageId }
}

// 재정부의 두 번째 사람: 기획부원을 재정부에도 넣는다.
async function addSecondFinance(s: PurchaseKit) {
  await s.db.transaction(tx =>
    createRecord(tx, {
      kind: 'department_membership',
      councilId: s.council.councilId,
      actor: s.council.people.president.memberId,
      values: {
        memberId: s.council.people.planningMember.memberId,
        departmentId: s.council.departments.finance,
        cohortId: s.council.cohortId,
        departmentRank: null,
        startsAt: clockNow,
      },
    }),
  )
  return 's-planningMember'
}

test(
  '같은 번호·같은 본문의 재전송은 201과 같은 지출의 상세이고, 지출·결제 내역·결재 기록·판·근거 연결·합계가 그대로다',
  runPurchases(async s => {
    const p = await prepare(s)
    const bodies = [
      {
        ...BODY,
        lines: [
          { lineItemId: p.first, amount: 9000 },
          { lineItemId: p.second, amount: 6000 },
        ],
        sourceMessageId: p.messageId,
        commandId: randomUUID(),
      },
      { ...BODY, budgetItemId: p.budgetItemId, commandId: randomUUID() },
    ]
    for (const body of bodies) {
      const first = await send(s, body)
      assert.equal(first.status, 201)
      const created = await detailOf(first)
      const shape = await shapeOf(s)
      const budget = await budgetOf(s)
      const again = await send(s, body)
      assert.equal(again.status, 201)
      assert.deepEqual(await detailOf(again), created)
      assert.deepEqual(await shapeOf(s), shape)
      assert.equal(await budgetOf(s), budget)
    }
    assert.equal(await receipts(s), 2)
    assert.equal(await s.count('SELECT count(*) AS n FROM evidence_link'), 1)
  }),
)

test(
  '취소한 뒤 같은 명령을 다시 보내면 201과 취소된 상세이고 아무것도 늘지 않는다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const created = await detailOf(await send(s, body))
    const cancel = await s.api.post(
      `${urlOf(s.council.councilId)}/${created.id}/cancel`,
      { reason: '잘못 적음' },
      FINANCE,
    )
    assert.equal(cancel.status, 200)
    const cancelled = await detailOf(cancel)
    assert.equal(cancelled.cancelled, true)
    const shape = await shapeOf(s)
    const again = await send(s, body)
    assert.equal(again.status, 201)
    assert.deepEqual(await detailOf(again), cancelled)
    assert.deepEqual(await shapeOf(s), shape)
  }),
)

test(
  '같은 번호에 다른 본문은 422 COMMAND_REUSED이고 아무것도 바뀌지 않는다(어느 칸이든)',
  runPurchases(async s => {
    const p = await prepare(s)
    const commandId = randomUUID()
    const body = { ...BODY, lines: [{ lineItemId: p.first, amount: 15000 }], commandId }
    const created = await detailOf(await send(s, body))
    const shape = await shapeOf(s)
    const changed: object[] = [
      { ...body, vendor: '다른 곳' },
      { ...body, description: '다른 내역' },
      { ...body, amount: 15001, lines: [{ lineItemId: p.first, amount: 15001 }] },
      { ...body, paidOn: '2026-10-24' },
      { ...body, method: 'cash' },
      { ...body, reason: '사유' },
      { ...body, paidBy: s.council.people.planningMember.memberId },
      { ...body, sourceMessageId: p.messageId },
      { ...body, lines: [{ lineItemId: p.second, amount: 15000 }] },
      { ...body, lines: [], budgetItemId: p.budgetItemId },
    ]
    for (const other of changed) {
      const response = await send(s, other)
      assert.equal(response.status, 422)
      assert.equal(await errorOf(response), 'COMMAND_REUSED')
    }
    assert.deepEqual(await shapeOf(s), shape)
    const read = await s.api.get(`${urlOf(s.council.councilId)}/${created.id}`, FINANCE)
    assert.deepEqual(await detailOf(read), created)
  }),
)

// 같은 사람(재정부원)이 다른 학생회의 재정부에도 있다. 학생회만 다른 같은 보낸 사람이다.
async function joinOtherCouncil(s: PurchaseKit) {
  const memberId = s.council.people.financeMember.memberId
  await s.db.transaction(async tx => {
    const actor = s.other.people.president.memberId
    const base = { councilId: s.other.councilId, actor }
    await createRecord(tx, {
      ...base,
      kind: 'council_membership',
      values: { memberId, cohortId: s.other.cohortId, councilRank: null, startsAt: clockNow },
    })
    await createRecord(tx, {
      ...base,
      kind: 'department_membership',
      values: {
        memberId,
        departmentId: s.other.departments.finance,
        cohortId: s.other.cohortId,
        departmentRank: null,
        startsAt: clockNow,
      },
    })
  })
}

test(
  '같은 번호를 다른 운영진이나 다른 학생회가 보내면 따로 센다',
  runPurchases(async s => {
    const second = await addSecondFinance(s)
    await joinOtherCouncil(s)
    const body = { ...BODY, commandId: randomUUID() }
    const mine = await detailOf(await send(s, body))
    const byOther = await send(s, body, second)
    assert.equal(byOther.status, 201)
    const otherMember = await detailOf(byOther)
    assert.notEqual(otherMember.id, mine.id)
    const elsewhere = await send(s, body, FINANCE, s.other.councilId)
    assert.equal(elsewhere.status, 201)
    const otherCouncil = await detailOf(elsewhere)
    assert.notEqual(otherCouncil.id, mine.id)
    assert.notEqual(otherCouncil.id, otherMember.id)
    assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 3)
    assert.equal(await receipts(s), 3)
    // 각자 같은 번호를 다시 보내면 자기 지출이다.
    assert.equal((await detailOf(await send(s, body, second))).id, otherMember.id)
    assert.equal((await detailOf(await send(s, body))).id, mine.id)
    assert.equal(
      (await detailOf(await send(s, body, FINANCE, s.other.councilId))).id,
      otherCouncil.id,
    )
    assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 3)
  }),
)

test(
  '403·409로 거절한 요청은 영수증을 남기지 않아 고쳐서 같은 번호로 다시 보낼 수 있다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    assert.equal((await send(s, body, PRESIDENT)).status, 403)
    assert.equal(await receipts(s), 0)
    // 학생회 밖의 행사(409), 볼 수 없는 근거 메시지(409, 지출을 만든 뒤에 걸린다)
    for (const bad of [{ eventId: MISSING }, { sourceMessageId: MISSING }]) {
      const response = await send(s, { ...body, ...bad })
      assert.equal(response.status, 409)
      assert.equal(await receipts(s), 0)
      assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 0)
    }
    const fixed = await send(s, body)
    assert.equal(fixed.status, 201)
    assert.equal(await receipts(s), 1)
  }),
)

test(
  '번호가 없거나 UUID가 아니면 400이고 아무것도 생기지 않는다',
  runPurchases(async s => {
    for (const commandId of [undefined, '', 'x', MISSING, randomUUID().toUpperCase().slice(1)]) {
      const response = await send(s, { ...BODY, commandId })
      assert.equal(response.status, 400)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 0)
    assert.equal(await receipts(s), 0)
  }),
)

test(
  '영수증은 결과와 같은 거래에 남는다: 지출 기록이 있는 만큼 영수증이 있고 지출을 가리킨다',
  runPurchases(async s => {
    const created = await detailOf(await send(s, { ...BODY, commandId: randomUUID() }))
    const rows = await s.pg.query<{ kind: string; scope_key: string; result_id: string }>(
      'SELECT kind, scope_key, result_id FROM command_receipt',
    )
    assert.deepEqual(rows.rows, [
      {
        kind: 'expense_create',
        scope_key: `${s.council.councilId}:${s.council.people.financeMember.memberId}`,
        result_id: created.id,
      },
    ])
  }),
)

test(
  '24시간이 지난 같은 번호는 새 명령이다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const first = await detailOf(await send(s, body))
    s.setNow(new Date('2026-10-26T03:00:01Z'))
    const later = await send(s, body)
    assert.equal(later.status, 201)
    assert.notEqual((await detailOf(later)).id, first.id)
    assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 2)
  }),
)
