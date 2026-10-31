import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { CreateIncomeSchema, type IncomeDetail } from '@vada/contracts'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 수입 다시 보내기(DEC-84, Q-finance-1): 같은 명령 번호의 재전송은 처음 수입의 지금 상세를 주고 아무것도 늘리지 않는다.

const FINANCE = 's-financeMember'
const BODY = { source: 'fee', amount: 300000, receivedOn: '2026-10-25' }

const urlOf = (councilId: string) => `/api/organizations/${councilId}/incomes`
const send = (
  t: SettlementKit,
  body: object,
  user: string | undefined = FINANCE,
  councilId = t.council.councilId,
) => t.api.post(urlOf(councilId), body, user)
const detailOf = async (response: Response) =>
  ((await response.json()) as { income: IncomeDetail }).income
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const countOf = async (t: SettlementKit, table: string) =>
  Number(((await t.pg.query(`SELECT count(*) AS n FROM ${table}`)).rows[0] as { n: string }).n)
const shapeOf = (t: SettlementKit) =>
  Promise.all(['record', 'record_version', 'income'].map(table => countOf(t, table)))
const receipts = (t: SettlementKit) => countOf(t, 'command_receipt')
const incomes = (t: SettlementKit) => countOf(t, 'income')

// 같은 사람(재정부원)이 다른 학생회의 재정부에도 있다. 학생회만 다른 같은 보낸 사람이다.
async function joinOtherCouncil(t: SettlementKit) {
  const memberId = t.council.people.financeMember.memberId
  await t.db.transaction(async tx => {
    const base = { councilId: t.other.councilId, actor: t.other.people.president.memberId }
    await createRecord(tx, {
      ...base,
      kind: 'council_membership',
      values: { memberId, cohortId: t.other.cohortId, councilRank: null, startsAt: clockNow },
    })
    await createRecord(tx, {
      ...base,
      kind: 'department_membership',
      values: {
        memberId,
        departmentId: t.other.departments.finance,
        cohortId: t.other.cohortId,
        departmentRank: null,
        startsAt: clockNow,
      },
    })
  })
}

// 재정부의 두 번째 사람: 기획부원을 재정부에도 넣는다.
async function addSecondFinance(t: SettlementKit) {
  await t.db.transaction(tx =>
    createRecord(tx, {
      kind: 'department_membership',
      councilId: t.council.councilId,
      actor: t.council.people.president.memberId,
      values: {
        memberId: t.council.people.planningMember.memberId,
        departmentId: t.council.departments.finance,
        cohortId: t.council.cohortId,
        departmentRank: null,
        startsAt: clockNow,
      },
    }),
  )
  return 's-planningMember'
}

test(
  '같은 번호·같은 본문의 재전송은 201과 같은 수입의 상세이고 수입·판이 그대로다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, description: '학생회비', commandId: randomUUID() }
    const first = await send(t, body)
    assert.equal(first.status, 201)
    const created = await detailOf(first)
    const shape = await shapeOf(t)
    const again = await send(t, body)
    assert.equal(again.status, 201)
    assert.deepEqual(await detailOf(again), created)
    assert.deepEqual(await shapeOf(t), shape)
    assert.equal(await receipts(t), 1)
  }),
)

test(
  '취소한 뒤 같은 명령을 다시 보내면 201과 취소된 상세이고 새 수입이 생기지 않는다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    const created = await detailOf(await send(t, body))
    const cancel = await t.api.post(
      `${urlOf(t.council.councilId)}/${created.id}/cancel`,
      { reason: '잘못 적음' },
      FINANCE,
    )
    assert.equal(cancel.status, 200)
    const shape = await shapeOf(t)
    const again = await send(t, body)
    assert.equal(again.status, 201)
    const resent = await detailOf(again)
    assert.equal(resent.id, created.id)
    assert.equal(resent.cancelled, true)
    assert.deepEqual(await shapeOf(t), shape)
  }),
)

// 계약의 칸마다 그 칸 하나만 바꾼 본문. 해시에서 어느 칸을 빼도 422가 아니라 201이나 409가 되어 시험이 실패한다.
const ONE_FIELD_CHANGES: Record<string, unknown> = {
  source: 'grant',
  amount: 300001,
  receivedOn: '2026-10-24',
  description: '다른 내용',
  budgetItemId: MISSING,
  accountId: MISSING,
}

test(
  '본문 칸 하나만 바꿔도 같은 번호는 422 COMMAND_REUSED이고 아무것도 바뀌지 않는다',
  withSettlement(async t => {
    // 계약에 칸이 늘면 이 목록과 해시에 넣었는지 함께 봐야 하므로 여기서 실패한다.
    const fields = Object.keys(CreateIncomeSchema.shape).filter(key => key !== 'commandId')
    assert.deepEqual(Object.keys(ONE_FIELD_CHANGES).sort(), fields.sort())
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    assert.equal((await send(t, body)).status, 201)
    const shape = await shapeOf(t)
    for (const [field, value] of Object.entries(ONE_FIELD_CHANGES)) {
      const response = await send(t, { ...body, [field]: value })
      assert.equal(response.status, 422, field)
      assert.equal(await errorOf(response), 'COMMAND_REUSED', field)
    }
    assert.deepEqual(await shapeOf(t), shape)
  }),
)

test(
  '같은 번호를 다른 운영진이나 다른 학생회가 보내면 따로 센다',
  withSettlement(async t => {
    await t.budgetOf()
    await t.budgetOf(t.other)
    const second = await addSecondFinance(t)
    await joinOtherCouncil(t)
    const body = { ...BODY, commandId: randomUUID() }
    const mine = await detailOf(await send(t, body))
    const byOther = await send(t, body, second)
    assert.equal(byOther.status, 201)
    const otherMember = await detailOf(byOther)
    assert.notEqual(otherMember.id, mine.id)
    const elsewhere = await send(t, body, FINANCE, t.other.councilId)
    assert.equal(elsewhere.status, 201)
    const otherCouncil = await detailOf(elsewhere)
    assert.deepEqual(new Set([mine.id, otherMember.id, otherCouncil.id]).size, 3)
    assert.equal(await incomes(t), 3)
    assert.equal(await receipts(t), 3)
    // 각자 같은 번호를 다시 보내면 자기 수입이다.
    assert.equal((await detailOf(await send(t, body, second))).id, otherMember.id)
    assert.equal((await detailOf(await send(t, body))).id, mine.id)
    assert.equal(
      (await detailOf(await send(t, body, FINANCE, t.other.councilId))).id,
      otherCouncil.id,
    )
    assert.equal(await incomes(t), 3)
  }),
)

test(
  '다른 학생회 사람이 번호를 알아도 남의 수입을 받지 못한다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    const mine = await detailOf(await send(t, body))
    const denied = await send(t, body, 'o-president')
    assert.equal(denied.status, 403)
    assert.equal(JSON.stringify(await denied.json()).includes(mine.id), false)
    assert.equal(await incomes(t), 1)
  }),
)

test(
  '403·409로 거절한 요청은 영수증을 남기지 않아 고쳐서 같은 번호로 다시 보낼 수 있다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    assert.equal((await send(t, body, 's-president')).status, 403)
    assert.equal(await receipts(t), 0)
    const rejected = await send(t, { ...body, accountId: MISSING })
    assert.equal(rejected.status, 409)
    assert.equal(await receipts(t), 0)
    assert.equal(await incomes(t), 0)
    assert.equal((await send(t, body)).status, 201)
    assert.equal(await receipts(t), 1)
  }),
)

test(
  '번호 꼴이 틀리면 400이고 로그인하지 않으면 401이며 아무것도 생기지 않는다',
  withSettlement(async t => {
    await t.budgetOf()
    for (const commandId of ['', 'x', MISSING, 7, randomUUID().slice(1)]) {
      const response = await send(t, { ...BODY, commandId })
      assert.equal(response.status, 400)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal((await send(t, BODY, '')).status, 401)
    assert.equal(await incomes(t), 0)
    assert.equal(await receipts(t), 0)
  }),
)

test(
  '번호 없는 옛 화면의 요청은 전처럼 받되 영수증을 남기지 않는다(배포 전환 중)',
  withSettlement(async t => {
    await t.budgetOf()
    const response = await send(t, { ...BODY, commandId: undefined })
    assert.equal(response.status, 201)
    assert.equal(await incomes(t), 1)
    assert.equal(await receipts(t), 0)
  }),
)

test(
  '영수증은 보낸 학생회·사람 범위로 수입을 가리키고, 24시간이 지난 같은 번호는 새 명령이다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    const first = await detailOf(await send(t, body))
    const rows = await t.pg.query('SELECT kind, scope_key, result_id FROM command_receipt')
    assert.deepEqual(rows.rows, [
      {
        kind: 'income_create',
        scope_key: `${t.council.councilId}:${t.council.people.financeMember.memberId}`,
        result_id: first.id,
      },
    ])
    t.setNow(new Date('2026-10-26T03:00:01Z'))
    const later = await send(t, body)
    assert.equal(later.status, 201)
    assert.notEqual((await detailOf(later)).id, first.id)
    assert.equal(await incomes(t), 2)
  }),
)

test(
  '재정부에서 빠진 뒤의 재전송은 403이다',
  withSettlement(async t => {
    await t.budgetOf()
    const body = { ...BODY, commandId: randomUUID() }
    assert.equal((await send(t, body)).status, 201)
    const membership = await t.pg.query<{ id: string }>(
      'SELECT id FROM department_membership WHERE member_id = $1 AND department_id = $2',
      [t.council.people.financeMember.memberId, t.council.departments.finance],
    )
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: membership.rows[0]!.id,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    assert.equal((await send(t, body)).status, 403)
    assert.equal(await incomes(t), 1)
  }),
)
