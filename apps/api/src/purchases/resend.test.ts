import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { CreatePurchaseRequestSchema } from '@vada/contracts'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import {
  detailOf,
  errorOf,
  ITEM,
  MISSING,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

// 구매 요청 다시 보내기(DEC-84, Q-finance-2): 같은 명령 번호의 재전송은 처음 요청의 지금 상세를 주고 아무것도 늘리지 않는다.

const PLANNER = 's-planningMember'
const FINANCE = 's-financeMember'
const BODY = { title: '마커', items: [ITEM] }

const receipts = (s: PurchaseKit) => s.count('SELECT count(*) AS n FROM command_receipt')
const requests = (s: PurchaseKit) => s.count('SELECT count(*) AS n FROM request')
// 요청·품목·판·알림·근거 연결·업무 연결 어느 것도 늘지 않았는지 보는 모양이다.
const shapeOf = (s: PurchaseKit) =>
  Promise.all(
    ['record', 'record_version', 'request', 'line_item', 'notification', 'evidence_link'].map(
      table => s.count(`SELECT count(*) AS n FROM ${table}`),
    ),
  )
const sendTo = (s: PurchaseKit, councilId: string, body: object, user: string) =>
  s.api.post(`/api/organizations/${councilId}/purchase-requests`, body, user)

test(
  '같은 번호·같은 본문의 재전송은 201과 같은 요청의 상세이고 요청·품목·판·알림·휴대폰 알림이 그대로다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const created = await s.made(body)
    await s.settled()
    const shape = await shapeOf(s)
    const pushed = s.calls.length
    assert.equal(pushed > 0, true)
    const again = await s.create(body)
    assert.equal(again.status, 201)
    assert.deepEqual(await detailOf(again), created)
    await s.settled()
    assert.deepEqual(await shapeOf(s), shape)
    assert.equal(s.calls.length, pushed)
    assert.equal(await receipts(s), 1)
  }),
)

test(
  '취소한 뒤 같은 명령을 다시 보내면 201과 취소된 상세이고 새 요청이 생기지 않는다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const created = await s.made(body)
    const cancel = await s.api.post(`${s.base}/${created.id}/cancel`, {}, PLANNER)
    assert.equal(cancel.status, 204)
    const shape = await shapeOf(s)
    const again = await s.create(body)
    assert.equal(again.status, 201)
    const resent = await detailOf(again)
    assert.equal(resent.id, created.id)
    assert.equal(resent.status, 'cancelled')
    assert.deepEqual(await shapeOf(s), shape)
  }),
)

test(
  '품목 결재가 끝난 뒤의 재전송도 지금 상세이고 결재가 되돌아가지 않는다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const created = await s.made(body)
    await s.decide(created.items[0]!.id, 'rejected')
    const again = await s.create(body)
    assert.equal(again.status, 201)
    assert.equal((await detailOf(again)).status, 'rejected')
    assert.equal(await requests(s), 1)
  }),
)

// 칸마다 그 칸 하나만 바꾼 본문. 해시에서 어느 칸을 빼도 422가 아니라 201이나 409가 되어 시험이 실패한다.
const ONE_FIELD_CHANGES: Record<string, unknown> = {
  title: '다른 제목',
  eventId: MISSING,
  body: '다른 내용',
  neededBy: '2026-11-01',
  requestedBy: MISSING,
  sourceMessageId: MISSING,
  taskId: MISSING,
  items: [{ ...ITEM, quantity: 4 }],
}
const ONE_ITEM_FIELD_CHANGES: Record<string, unknown> = {
  name: '다른 품목',
  quantity: 4,
  link: 'https://example.com/other',
  options: '다른 옵션',
  estimatedUnitPrice: 100,
  estimatedShippingFee: 100,
}

test(
  '본문 칸 하나만 바꿔도 같은 번호는 422 COMMAND_REUSED이고 아무것도 바뀌지 않는다(요청과 품목의 모든 칸)',
  runPurchases(async s => {
    // 계약에 칸이 늘면 이 목록과 해시에 넣었는지 함께 봐야 하므로 여기서 실패한다.
    const schema = CreatePurchaseRequestSchema.shape
    assert.deepEqual(
      Object.keys(ONE_FIELD_CHANGES).sort(),
      Object.keys(schema)
        .filter(key => key !== 'commandId')
        .sort(),
    )
    assert.deepEqual(
      Object.keys(ONE_ITEM_FIELD_CHANGES).sort(),
      Object.keys(schema.items.element.shape).sort(),
    )
    // 남을 대신 내는 칸까지 보려고 재정부가 보낸다(그 밖의 사람은 그 칸이 403이다).
    const body = { ...BODY, commandId: randomUUID() }
    assert.equal((await s.create(body, FINANCE)).status, 201)
    const shape = await shapeOf(s)
    const changed = [
      ...Object.entries(ONE_FIELD_CHANGES).map(([key, value]) => ({ ...body, [key]: value })),
      ...Object.entries(ONE_ITEM_FIELD_CHANGES).map(([key, value]) => ({
        ...body,
        items: [{ ...ITEM, [key]: value }],
      })),
      { ...body, items: [ITEM, ITEM] },
    ]
    for (const other of changed) {
      const response = await s.create(other, FINANCE)
      assert.equal(response.status, 422, JSON.stringify(other))
      assert.equal(await errorOf(response), 'COMMAND_REUSED')
    }
    assert.deepEqual(await shapeOf(s), shape)
  }),
)

test(
  '칸 앞뒤 공백처럼 계약이 지우는 차이는 같은 본문이다',
  runPurchases(async s => {
    const commandId = randomUUID()
    const created = await s.made({ ...BODY, commandId })
    const again = await s.create({ ...BODY, title: ' 마커 ', commandId })
    assert.equal(again.status, 201)
    assert.equal((await detailOf(again)).id, created.id)
  }),
)

// 같은 사람(기획부원)이 다른 학생회의 운영진이기도 하다. 학생회만 다른 같은 보낸 사람이다.
async function joinOtherCouncil(s: PurchaseKit) {
  await s.db.transaction(tx =>
    createRecord(tx, {
      councilId: s.other.councilId,
      actor: s.other.people.president.memberId,
      kind: 'council_membership',
      values: {
        memberId: s.council.people.planningMember.memberId,
        cohortId: s.other.cohortId,
        councilRank: null,
        startsAt: clockNow,
      },
    }),
  )
}

test(
  '같은 번호를 다른 운영진이나 다른 학생회가 보내면 따로 센다',
  runPurchases(async s => {
    await joinOtherCouncil(s)
    const body = { ...BODY, commandId: randomUUID() }
    const mine = await s.made(body)
    const byOther = await s.create(body, 's-plain')
    assert.equal(byOther.status, 201)
    const otherMember = await detailOf(byOther)
    assert.notEqual(otherMember.id, mine.id)
    assert.equal(otherMember.requestedBy.name, 's plain')
    const elsewhere = await sendTo(s, s.other.councilId, body, PLANNER)
    assert.equal(elsewhere.status, 201)
    const otherCouncil = await detailOf(elsewhere)
    assert.equal(new Set([mine.id, otherMember.id, otherCouncil.id]).size, 3)
    assert.equal(await requests(s), 3)
    assert.equal(await receipts(s), 3)
    // 각자 같은 번호를 다시 보내면 자기 요청이다.
    assert.equal((await detailOf(await s.create(body, 's-plain'))).id, otherMember.id)
    assert.equal((await detailOf(await s.create(body))).id, mine.id)
    assert.equal(
      (await detailOf(await sendTo(s, s.other.councilId, body, PLANNER))).id,
      otherCouncil.id,
    )
    assert.equal(await requests(s), 3)
  }),
)

test(
  '다른 학생회 사람이 번호를 알아도 남의 요청을 받지 못한다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const mine = await s.made(body)
    const denied = await s.create(body, 'o-president')
    assert.equal(denied.status, 403)
    assert.equal(JSON.stringify(await denied.json()).includes(mine.id), false)
    assert.equal(await requests(s), 1)
  }),
)

test(
  '409로 거절한 요청은 영수증을 남기지 않아 고쳐서 같은 번호로 다시 보낼 수 있다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    for (const bad of [{ eventId: MISSING }, { sourceMessageId: MISSING }]) {
      const response = await s.create({ ...body, ...bad })
      assert.equal(response.status, 409)
      assert.equal(await receipts(s), 0)
      assert.equal(await requests(s), 0)
    }
    assert.equal((await s.create(body)).status, 201)
    assert.equal(await receipts(s), 1)
  }),
)

test(
  '번호 꼴이 틀리면 400이고 로그인하지 않으면 401이며 아무것도 생기지 않는다',
  runPurchases(async s => {
    for (const commandId of ['', 'x', MISSING, 7, randomUUID().slice(1)]) {
      const response = await s.create({ ...BODY, commandId })
      assert.equal(response.status, 400)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal((await s.api.post(s.base, BODY)).status, 401)
    assert.equal(await requests(s), 0)
    assert.equal(await receipts(s), 0)
  }),
)

test(
  '번호 없는 옛 화면의 요청은 전처럼 받되 영수증을 남기지 않는다(배포 전환 중)',
  runPurchases(async s => {
    assert.equal((await s.create({ ...BODY, commandId: undefined })).status, 201)
    assert.equal(await requests(s), 1)
    assert.equal(await receipts(s), 0)
  }),
)

test(
  '영수증은 보낸 학생회·사람 범위로 요청을 가리키고, 24시간이 지난 같은 번호는 새 명령이다',
  runPurchases(async s => {
    const body = { ...BODY, commandId: randomUUID() }
    const first = await s.made(body)
    const rows = await s.pg.query('SELECT kind, scope_key, result_id FROM command_receipt')
    assert.deepEqual(rows.rows, [
      {
        kind: 'request_create',
        scope_key: `${s.council.councilId}:${s.council.people.planningMember.memberId}`,
        result_id: first.id,
      },
    ])
    s.setNow(new Date('2026-10-26T03:00:01Z'))
    const later = await s.create(body)
    assert.equal(later.status, 201)
    assert.notEqual((await detailOf(later)).id, first.id)
    assert.equal(await requests(s), 2)
  }),
)

test(
  '재정부에서 빠진 사람이 남을 대신 낸 요청을 다시 보내면 403이다',
  runPurchases(async s => {
    const body = {
      ...BODY,
      requestedBy: s.council.people.plain.memberId,
      commandId: randomUUID(),
    }
    assert.equal((await s.create(body, FINANCE)).status, 201)
    const membership = await s.pg.query<{ id: string }>(
      'SELECT id FROM department_membership WHERE member_id = $1 AND department_id = $2',
      [s.council.people.financeMember.memberId, s.council.departments.finance],
    )
    await s.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: membership.rows[0]!.id,
        actor: s.council.people.president.memberId,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    assert.equal((await s.create(body, FINANCE)).status, 403)
    assert.equal(await requests(s), 1)
  }),
)

test(
  '요청을 대신 받은 사람이 떠나도 같은 명령의 재전송은 처음 요청이다',
  runPurchases(async s => {
    const body = {
      ...BODY,
      requestedBy: s.council.people.plain.memberId,
      commandId: randomUUID(),
    }
    const created = await detailOf(await s.create(body, FINANCE))
    await s.pg.query(`UPDATE council_membership SET ends_at = now() WHERE member_id = $1`, [
      s.council.people.plain.memberId,
    ])
    const again = await s.create(body, FINANCE)
    assert.equal(again.status, 201)
    assert.equal((await detailOf(again)).id, created.id)
    assert.equal(await requests(s), 1)
  }),
)
