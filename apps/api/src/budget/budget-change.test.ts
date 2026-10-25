import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetItemView, BudgetResponse, ClosingResponse } from '@vada/contracts'
import { clockNow } from '../records/records.js'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 예산 편성(024 조각 6): 여러 행을 한 거래로 넣기, 사유와 함께 고치기, 쓰인 적 없는 항목 지우기.

const FINANCE = 's-financeMember'
const emoji = (n: number) => '😀'.repeat(n)

const root = (t: SettlementKit) => `/api/organizations/${t.council.councilId}`
const post = (t: SettlementKit, path: string, body: unknown, user = FINANCE) =>
  t.api.post(`${root(t)}${path}`, body, user)
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const viewOf = async (response: Response) => (await response.json()) as BudgetResponse
const budgetRead = async (t: SettlementKit, user = FINANCE) =>
  viewOf(await t.api.get(`${root(t)}/budget`, user))
const itemCount = async (t: SettlementKit) =>
  Number((await t.pg.query<{ n: string }>('SELECT count(*) AS n FROM budget_item')).rows[0]!.n)
const versions = async (t: SettlementKit, id: string) =>
  Number(
    (
      await t.pg.query<{ n: string }>(
        'SELECT count(*) AS n FROM record_version WHERE record_id = $1',
        [id],
      )
    ).rows[0]!.n,
  )
const batch = (t: SettlementKit, items: unknown[], user = FINANCE) =>
  post(t, '/budget-items/batch', { items }, user)
const named = (view: BudgetResponse, purpose: string) =>
  view.items.find(item => item.purpose === purpose) as BudgetItemView

test(
  '여러 행 넣기: 한 거래로 모두 들어가 판 1이고 목적순으로 보인다. 재정부만 하고 기간이 없으면 409다',
  withSettlement(async t => {
    const none = await batch(t, [{ purpose: '비품', amount: 1000 }])
    assert.equal(await errorOf(none), 'NO_FISCAL_PERIOD')
    await t.budgetOf()
    const event = await t.event({ name: '체육대회' })
    const rows = ['행사 운영비', '홍보비', '식비'].map((purpose, index) => ({
      purpose,
      amount: (index + 1) * 100000,
      eventId: event,
    }))
    for (const user of ['s-president', 's-planningMember', 'o-financeMember'])
      assert.equal((await batch(t, rows, user)).status, 403, user)
    assert.equal((await t.api.post(`${root(t)}/budget-items/batch`, { items: rows })).status, 401)
    assert.equal(await itemCount(t), 0)
    const response = await batch(t, rows)
    assert.equal(response.status, 201)
    const view = await viewOf(response)
    assert.deepEqual(
      view.items.map(item => [item.purpose, item.amount, item.type, item.event?.name]),
      [
        ['식비', 300000, 'expense', '체육대회'],
        ['행사 운영비', 100000, 'expense', '체육대회'],
        ['홍보비', 200000, 'expense', '체육대회'],
      ],
    )
    for (const item of view.items) assert.equal(await versions(t, item.id), 1)
    assert.deepEqual(await budgetRead(t, 's-plain'), view)
  }),
)

test(
  '여러 행 넣기: 한 행이라도 0원, 상한+1, 빈 이름, 모르는 키면 400이고 아무것도 남지 않는다. 행 상한은 20이다',
  withSettlement(async t => {
    await t.budgetOf()
    const good = { purpose: '비품', amount: 1000 }
    const bad: [string, unknown[]][] = [
      ['0원', [good, { purpose: '예비비', amount: 0 }]],
      ['음수', [good, { purpose: '예비비', amount: -1 }]],
      ['10억+1', [good, { purpose: '예비비', amount: 1_000_000_001 }]],
      ['빈 이름', [good, { purpose: ' ', amount: 1 }]],
      ['이름 101자', [good, { purpose: emoji(101), amount: 1 }]],
      ['이름 NUL', [good, { purpose: 'a\u0000', amount: 1 }]],
      ['모르는 키', [good, { purpose: '예비비', amount: 1, extra: 1 }]],
      ['행 없음', []],
      ['21행', Array.from({ length: 21 }, (_, i) => ({ purpose: `항목 ${i}`, amount: 1 }))],
    ]
    for (const [label, items] of bad) {
      const response = await batch(t, items)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal((await post(t, '/budget-items/batch', { items: [good], x: 1 })).status, 400)
    assert.equal((await post(t, '/budget-items', { purpose: '예비비', amount: 0 })).status, 400)
    assert.equal(await itemCount(t), 0)
    const twenty = Array.from({ length: 20 }, (_, i) => ({ purpose: `항목 ${i}`, amount: 1 }))
    assert.equal((await batch(t, twenty)).status, 201)
    assert.equal(await itemCount(t), 20)
  }),
)

test(
  '같은 예산·같은 행사 안의 같은 이름은 400 BUDGET_ITEM_DUPLICATE이고 아무것도 남지 않는다. 다른 행사나 행사 없음과는 같아도 된다',
  withSettlement(async t => {
    await t.budgetOf()
    const spring = await t.event({ name: '봄 축제' })
    const autumn = await t.event({ name: '가을 축제' })
    assert.equal((await batch(t, [{ purpose: '식비', amount: 1000, eventId: spring }])).status, 201)
    const duplicates: [string, unknown[]][] = [
      [
        '한 번에 넣는 행끼리',
        [
          { purpose: '홍보비', amount: 1, eventId: autumn },
          { purpose: ' 홍보비 ', amount: 2, eventId: autumn },
        ],
      ],
      [
        '이미 있는 항목과',
        [
          { purpose: '홍보비', amount: 1, eventId: spring },
          { purpose: '식비', amount: 2, eventId: spring },
        ],
      ],
      ['수입 항목이어도', [{ purpose: '식비', amount: 2, eventId: spring, type: 'income' }]],
    ]
    for (const [label, items] of duplicates) {
      const response = await batch(t, items)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'BUDGET_ITEM_DUPLICATE', label)
    }
    const single = await post(t, '/budget-items', { purpose: '식비', amount: 1, eventId: spring })
    assert.equal(await errorOf(single), 'BUDGET_ITEM_DUPLICATE')
    assert.equal(await itemCount(t), 1)
    const allowed = await batch(t, [
      { purpose: '식비', amount: 1, eventId: autumn },
      { purpose: '식비', amount: 1 },
    ])
    assert.equal(allowed.status, 201)
    assert.equal(await itemCount(t), 3)
  }),
)

test(
  '여러 행 넣기: 다른 학생회 행사는 EVENT_INVALID, 완료한 행사는 EVENT_COMPLETED이고 아무것도 남지 않는다',
  withSettlement(async t => {
    await t.budgetOf()
    const theirs = await t.event({}, t.other)
    const done = await t.event()
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    const good = { purpose: '비품', amount: 1000 }
    const theirRows = [good, { purpose: '식비', amount: 1, eventId: theirs }]
    assert.equal(await errorOf(await batch(t, theirRows)), 'EVENT_INVALID')
    const doneRows = [good, { purpose: '식비', amount: 1, eventId: done }]
    assert.equal(await errorOf(await batch(t, doneRows)), 'EVENT_COMPLETED')
    assert.equal(await itemCount(t), 0)
  }),
)

test(
  '고치기: 이름과 금액이 바뀌고 판에 이전·이후, 사유, 바꾼 사람이 남아 예산 응답의 이력에 보인다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '비품', amount: '100000' })
    const other = await t.budgetItem(budget, { purpose: '간식', amount: '5000' })
    const body = { purpose: ' 소모품 ', amount: 80000, reason: ' 회의에서 줄임 ' }
    for (const user of ['s-president', 's-planningMember', 'o-financeMember'])
      assert.equal((await post(t, `/budget-items/${item}`, body, user)).status, 403, user)
    assert.equal((await t.api.post(`${root(t)}/budget-items/${item}`, body)).status, 401)
    const response = await post(t, `/budget-items/${item}`, body)
    assert.equal(response.status, 200)
    const changed = named(await viewOf(response), '소모품')
    assert.equal(changed.amount, 80000)
    assert.equal(changed.available, 80000)
    assert.deepEqual(
      changed.history.map(version => [
        version.versionNo,
        version.purpose,
        version.amount,
        version.reason,
        version.by?.name ?? null,
      ]),
      [
        [1, '비품', 100000, null, 's president'],
        [2, '소모품', 80000, '회의에서 줄임', 's financeMember'],
      ],
    )
    assert.equal(await versions(t, other), 1)
    assert.deepEqual(await budgetRead(t, 's-plain'), await budgetRead(t))
    // 결산서의 예산 칸이 고친 금액을 읽는다.
    const closing = await t.api.get(`${root(t)}/fiscal-periods/${period}/closing`, FINANCE)
    assert.equal(closing.status, 200)
    const lines = ((await closing.json()) as ClosingResponse).closing.expense.items
    assert.deepEqual(
      lines.map(line => [line.purpose, line.budget]),
      [
        ['간식', 5000],
        ['소모품', 80000],
      ],
    )
  }),
)

test(
  '고치기 입력: 사유 없음·공백, 0원, 상한+1, 모르는 키, 종류·행사 키는 400이다. 같은 이름은 400 BUDGET_ITEM_DUPLICATE이고 바뀌지 않는다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '비품' })
    await t.budgetItem(budget, { purpose: '간식' })
    const body = { purpose: '비품', amount: 1000, reason: '줄임' }
    const bad: [string, unknown][] = [
      ['사유 없음', { purpose: '비품', amount: 1000 }],
      ['사유 공백', { ...body, reason: '  ' }],
      ['사유 501자', { ...body, reason: emoji(501) }],
      ['0원', { ...body, amount: 0 }],
      ['10억+1', { ...body, amount: 1_000_000_001 }],
      ['이름 101자', { ...body, purpose: emoji(101) }],
      ['종류', { ...body, type: 'income' }],
      ['행사', { ...body, eventId: null }],
    ]
    for (const [label, input] of bad) {
      const response = await post(t, `/budget-items/${item}`, input)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    const clash = await post(t, `/budget-items/${item}`, { ...body, purpose: ' 간식' })
    assert.equal(clash.status, 400)
    assert.equal(await errorOf(clash), 'BUDGET_ITEM_DUPLICATE')
    assert.equal(await versions(t, item), 1)
    // 자기 이름 그대로 금액만 바꾸는 것은 된다.
    assert.equal((await post(t, `/budget-items/${item}`, body)).status, 200)
  }),
)

test(
  '고치기: 이름이 그대로면 같은 이름을 보지 않아, 막기 전에 생긴 같은 이름의 항목도 금액을 고친다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const first = await t.budgetItem(budget, { purpose: '비품' })
    await t.budgetItem(budget, { purpose: '비품' })
    const response = await post(t, `/budget-items/${first}`, {
      purpose: '비품',
      amount: 70000,
      reason: '줄임',
    })
    assert.equal(response.status, 200)
    assert.equal(await versions(t, first), 2)
  }),
)

test(
  '고치기·지우기: 다른 학생회와 없는 항목은 404, 완료한 행사의 항목은 EVENT_COMPLETED, 공개한 기간의 항목은 PERIOD_CLOSED다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const theirs = (await t.budgetOf(t.other)).budget
    const theirItem = await t.budgetItem(theirs, { purpose: '남의 것' }, t.other)
    const done = await t.event()
    const doneItem = await t.budgetItem(budget, { purpose: '행사비', eventId: done })
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    const body = { purpose: '바꿈', amount: 1, reason: '사유' }
    for (const id of [theirItem, MISSING]) {
      assert.equal(await errorOf(await post(t, `/budget-items/${id}`, body)), 'NOT_FOUND')
      assert.equal(await errorOf(await post(t, `/budget-items/${id}/delete`, {})), 'NOT_FOUND')
    }
    assert.equal(await errorOf(await post(t, '/budget-items/x', body)), 'NOT_FOUND')
    assert.equal(await errorOf(await post(t, `/budget-items/${doneItem}`, body)), 'EVENT_COMPLETED')
    const doneDelete = await post(t, `/budget-items/${doneItem}/delete`, {})
    assert.equal(await errorOf(doneDelete), 'EVENT_COMPLETED')
    const plain = await t.budgetItem(budget, { purpose: '비품' })
    await t.make(t.council, 'account_closing', { fiscalPeriodId: period, publishedAt: clockNow })
    assert.equal(await errorOf(await post(t, `/budget-items/${plain}`, body)), 'PERIOD_CLOSED')
    assert.equal(await errorOf(await post(t, `/budget-items/${plain}/delete`, {})), 'PERIOD_CLOSED')
    assert.equal(await versions(t, plain), 1)
    assert.equal(await itemCount(t), 3)
  }),
)

test(
  '지우기: 쓰인 적 없고 고친 적 없는 항목만 판·하위 행·기록이 함께 지워지고, 요청·결재·지출·수입이 가리켰거나 고친 항목은 409 BUDGET_ITEM_IN_USE다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const unused = await t.budgetItem(budget, { purpose: '예비비' })
    const approved = await t.budgetItem(budget, { purpose: '결재' })
    const spent = await t.budgetItem(budget, { purpose: '지출' })
    const income = await t.budgetItem(budget, { purpose: '수입', type: 'income' })
    const requested = await t.budgetItem(budget, { purpose: '요청' })
    const edited = await t.budgetItem(budget, { purpose: '고침' })
    assert.equal(
      (await post(t, `/budget-items/${edited}`, { purpose: '고침', amount: 5, reason: '줄임' }))
        .status,
      200,
    )
    const { line } = await t.requestWithItem(null, { defaultBudgetItemId: requested })
    const second = await t.requestWithItem(null)
    await t.pg.query('UPDATE line_item SET budget_item_id = $1 WHERE id = $2', [
      approved,
      second.line,
    ])
    await t.approve(second.line)
    await t.expense({ budgetItemId: spent, cancelledAt: clockNow })
    await t.make(t.council, 'income', {
      fiscalPeriodId: period,
      source: 'other',
      amount: '1000',
      receivedOn: '2026-10-20',
      description: '후원',
      budgetItemId: income,
    })
    assert.ok(line)
    const before = await budgetRead(t)
    assert.deepEqual(Object.fromEntries(before.items.map(item => [item.purpose, item.deletable])), {
      결재: false,
      고침: false,
      수입: false,
      예비비: true,
      요청: false,
      지출: false,
    })
    for (const user of ['s-president', 's-planningMember', 'o-financeMember'])
      assert.equal((await post(t, `/budget-items/${unused}/delete`, {}, user)).status, 403, user)
    for (const id of [approved, spent, income, requested, edited]) {
      const response = await post(t, `/budget-items/${id}/delete`, {})
      assert.equal(response.status, 409, id)
      assert.equal(await errorOf(response), 'BUDGET_ITEM_IN_USE', id)
    }
    assert.equal((await post(t, `/budget-items/${unused}/delete`, { x: 1 })).status, 400)
    const response = await post(t, `/budget-items/${unused}/delete`, {})
    assert.equal(response.status, 200)
    assert.deepEqual(
      (await viewOf(response)).items.map(item => item.purpose),
      ['결재', '고침', '수입', '요청', '지출'],
    )
    const left = await t.pg.query(
      `SELECT (SELECT count(*) FROM record WHERE id = $1)::int AS records,
        (SELECT count(*) FROM record_version WHERE record_id = $1)::int AS versions,
        (SELECT count(*) FROM budget_item WHERE id = $1)::int AS items`,
      [unused],
    )
    assert.deepEqual(left.rows[0], { records: 0, versions: 0, items: 0 })
  }),
)
