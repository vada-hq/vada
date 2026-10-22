import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IncomeDetail } from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

const FINANCE = 's-financeMember'
const BASE = { source: 'fee', amount: 300000, receivedOn: '2026-10-25' }

const incomeOf = async (response: Response) =>
  ((await response.json()) as { income: IncomeDetail }).income
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const root = (t: SettlementKit, councilId = t.council.councilId) =>
  `/api/organizations/${councilId}/incomes`
const post = (t: SettlementKit, body: unknown, user: string | null = FINANCE) =>
  t.api.post(root(t), body, user ?? undefined)
const incomeCount = (t: SettlementKit) =>
  t.pg
    .query('SELECT count(*) AS n FROM income')
    .then(result => Number((result.rows[0] as { n: string }).n))
const versionsOf = (t: SettlementKit, id: string) =>
  t.pg
    .query('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id])
    .then(result => Number((result.rows[0] as { n: string }).n))
const account = (t: SettlementKit, values: object = {}, owner = t.council) =>
  t.make(owner, 'account', {
    name: '대표',
    bank: '국민은행',
    accountNumber: '123-45-6789012',
    holder: '학생회',
    type: 'main',
    ...values,
  })

test(
  '재정부가 수입을 적는다: 201, 받은 날이 든 기간, 적은 사람, 판 1, 취소 동작',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { type: 'income', purpose: '학생회비' })
    const bank = await account(t)
    const response = await post(t, {
      ...BASE,
      description: ' 2학기 학생회비 ',
      budgetItemId: item,
      accountId: bank,
    })
    assert.equal(response.status, 201)
    const detail = await incomeOf(response)
    assert.deepEqual(
      [detail.source, detail.amount, detail.receivedOn, detail.description, detail.cancelled],
      ['fee', 300000, '2026-10-25', '2학기 학생회비', false],
    )
    assert.deepEqual(detail.period, { id: period, name: '2026-2' })
    assert.deepEqual(detail.budgetItem, { id: item, purpose: '학생회비' })
    assert.deepEqual(detail.account, { id: bank, name: '대표' })
    assert.equal(detail.createdBy?.name, 's financeMember')
    assert.equal(await versionsOf(t, detail.id), 1)
    assert.deepEqual(
      detail.history.map(version => version.changes),
      [[{ field: 'created' }]],
    )
    assert.deepEqual(detail.actions, ['income.cancel'])
    const bare = await incomeOf(await post(t, { ...BASE, source: 'other' }))
    assert.deepEqual([bare.description, bare.budgetItem, bare.account], [null, null, null])
  }),
)

test(
  '재정부가 아니면 403이고 아무것도 생기지 않는다. 403은 다른 409보다 먼저다. 로그인하지 않으면 401이다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const event = await t.event()
    const item = await t.budgetItem(budget, { type: 'income', eventId: event })
    await t.completion(event, 'completed', new Date('2026-10-24T03:00:00Z'))
    for (const user of ['s-president', 's-planningMember', 'o-financeMember']) {
      assert.equal((await post(t, BASE, user)).status, 403, user)
      // 완료한 행사의 항목이어도 권한이 먼저다
      assert.equal((await post(t, { ...BASE, budgetItemId: item }, user)).status, 403, user)
    }
    assert.equal((await post(t, BASE, null)).status, 401)
    assert.equal(await incomeCount(t), 0)
  }),
)

test(
  '받은 날이 내일(한국)이면 400이고 오늘 23:59:59에는 오늘까지 받는다. 자정에 내일이 오늘이 된다',
  withSettlement(async t => {
    await t.budgetOf()
    t.setNow(new Date('2026-10-25T14:59:59Z'))
    assert.equal((await post(t, { ...BASE, receivedOn: '2026-10-26' })).status, 400)
    assert.equal((await post(t, { ...BASE, receivedOn: '2026-10-25' })).status, 201)
    t.setNow(new Date('2026-10-25T15:00:00Z'))
    assert.equal((await post(t, { ...BASE, receivedOn: '2026-10-26' })).status, 201)
    assert.equal((await post(t, { ...BASE, receivedOn: '2026-10-27' })).status, 400)
    assert.equal(await incomeCount(t), 2)
  }),
)

test(
  '받은 날이 든 회계 기간이 없으면 409 NO_FISCAL_PERIOD다. 기간의 첫날은 받고 그 전날은 받지 않는다',
  withSettlement(async t => {
    assert.equal(await errorOf(await post(t, BASE)), 'NO_FISCAL_PERIOD')
    await t.budgetOf()
    const before = await post(t, { ...BASE, receivedOn: '2026-08-31' })
    assert.equal(await errorOf(before), 'NO_FISCAL_PERIOD')
    assert.equal((await post(t, { ...BASE, receivedOn: '2026-09-01' })).status, 201)
    assert.equal(await incomeCount(t), 1)
  }),
)

test(
  '수입 예산 항목은 받은 날이 든 기간의 이 학생회 수입 항목이어야 한다(409 BUDGET_ITEM_INVALID)',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const expenseItem = await t.budgetItem(budget, { type: 'expense' })
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-01-01',
      endsOn: '2026-08-31',
    })
    const oldBudget = await t.make(t.council, 'budget', { fiscalPeriodId: old })
    const oldItem = await t.budgetItem(oldBudget, { type: 'income' })
    const theirs = await t.budgetOf(t.other)
    const theirItem = await t.budgetItem(theirs.budget, { type: 'income' }, t.other)
    for (const budgetItemId of [expenseItem, oldItem, theirItem, t.council.councilId])
      assert.equal(await errorOf(await post(t, { ...BASE, budgetItemId })), 'BUDGET_ITEM_INVALID')
    // 받은 날이 지난 기간이면 그 기간의 항목이 맞는다
    const inOld = await post(t, { ...BASE, receivedOn: '2026-08-31', budgetItemId: oldItem })
    assert.equal(inOld.status, 201)
    assert.equal(await incomeCount(t), 1)
  }),
)

test(
  '계좌는 이 학생회의 닫지 않은 것이어야 한다(409 ACCOUNT_INVALID)',
  withSettlement(async t => {
    await t.budgetOf()
    const closed = await account(t, { name: '옛 계좌', type: 'business', closedOn: '2026-01-01' })
    const theirs = await account(t, {}, t.other)
    for (const accountId of [closed, theirs])
      assert.equal(await errorOf(await post(t, { ...BASE, accountId })), 'ACCOUNT_INVALID')
    assert.equal(await incomeCount(t), 0)
  }),
)

test(
  '완료한 행사의 수입 항목을 고르면 409 EVENT_COMPLETED이고 아무것도 생기지 않는다. 다른 행사의 항목은 된다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const done = await t.event()
    const open = await t.event({ name: '열린 행사' })
    const doneItem = await t.budgetItem(budget, { type: 'income', eventId: done })
    const openItem = await t.budgetItem(budget, { type: 'income', eventId: open })
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    const response = await post(t, { ...BASE, budgetItemId: doneItem })
    assert.equal(await errorOf(response), 'EVENT_COMPLETED')
    assert.equal(await incomeCount(t), 0)
    assert.equal((await post(t, { ...BASE, budgetItemId: openItem })).status, 201)
    // 완료를 취소하면 다시 적힌다
    await t.completion(done, 'completion_cancelled', new Date('2026-10-24T04:00:00Z'), '다시')
    assert.equal((await post(t, { ...BASE, budgetItemId: doneItem })).status, 201)
    // 다른 학생회의 완료는 이쪽 항목에 닿지 않는다
    await t.completionOfOther(await t.event({}, t.other))
    assert.equal((await post(t, BASE)).status, 201)
  }),
)

test(
  '수입 적기는 요청·지출과 같은 한도를 받는다(429)',
  withSettlement(
    async t => {
      await t.budgetOf()
      assert.equal((await post(t, BASE)).status, 201)
      const limited = await post(t, BASE)
      assert.equal(limited.status, 429)
      assert.equal(await errorOf(limited), 'TOO_MANY_REQUESTS')
      assert.equal(await incomeCount(t), 1)
    },
    { limit: 1 },
  ),
)

test(
  '다른 학생회 사람이 만든 수입은 이쪽 목록과 상세에 없다',
  withSettlement(async t => {
    const mine = await t.budgetOf()
    const theirs = await t.budgetOf(t.other)
    await t.make(t.other, 'income', {
      fiscalPeriodId: theirs.period,
      source: 'fee',
      amount: '1000',
      receivedOn: '2026-10-01',
    })
    await post(t, BASE)
    const list = (await (
      await t.api.get(`${root(t)}?period=${mine.period}`, 's-president')
    ).json()) as { incomes: unknown[] }
    assert.equal(list.incomes.length, 1)
    assert.equal((await t.api.get(`${root(t)}?period=${theirs.period}`, 's-president')).status, 404)
  }),
)
