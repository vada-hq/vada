import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WON_MAX, type BudgetResponse } from '@vada/contracts'
import { clockNow } from '../records/records.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 약정(지출 예정)과 사용 가능(DEC-15, DEC-92, 024 조각 5). 예산 읽기와 행사 '예산·정산'이 같은 셈을 본다.

type Figures = {
  amount: number
  actual: number
  committed: number | null
  available: number | null
}

const budgetRead = async (t: SettlementKit, query = '', user = 's-plain') => {
  const response = await t.api.get(`/api/organizations/${t.council.councilId}/budget${query}`, user)
  assert.equal(response.status, 200)
  return (await response.json()) as BudgetResponse
}

const figuresOf = (item: Figures) => ({
  amount: item.amount,
  actual: item.actual,
  committed: item.committed,
  available: item.available,
})

async function budgetFigures(t: SettlementKit, itemId: string, query = '') {
  const found = (await budgetRead(t, query)).items.find(item => item.id === itemId)
  assert.ok(found, '예산 응답에 항목이 있다')
  return figuresOf(found)
}

async function settlementFigures(t: SettlementKit, eventId: string, itemId: string) {
  const found = (await t.settlement(eventId)).budget.items.find(item => item.id === itemId)
  assert.ok(found, '정산 응답에 항목이 있다')
  return figuresOf(found)
}

// 승인한 품목 하나: 금액과 예산 항목은 승인할 때 채워진다(DEC-40).
async function approvedLine(
  t: SettlementKit,
  target: { eventId: string | null; budgetItemId: string; amount: string },
  outcome: 'approved' | 'rejected' | 'cancelled' | null = 'approved',
) {
  const { request, line } = await t.requestWithItem(target.eventId)
  await t.pg.query('UPDATE line_item SET amount = $1, budget_item_id = $2 WHERE id = $3', [
    target.amount,
    target.budgetItemId,
    line,
  ])
  if (outcome === 'cancelled') await t.approve(line)
  if (outcome) await t.approve(line, outcome)
  return { request, line }
}

const paid = async (t: SettlementKit, line: string, amount: string, eventId: string | null) => {
  const expense = await t.expense({ amount, ...(eventId ? { eventId } : {}) })
  await t.pay(expense, line, amount)
  return expense
}

test(
  '승인하면 지출 예정이 늘고, 나눠 결제하면 남은 금액만, 다 결제하면 실제로 옮긴다. 두 화면의 숫자가 같다',
  withSettlement(async t => {
    const ev = await t.event()
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { eventId: ev, amount: '100000' })
    const same = async (expected: Figures) => {
      assert.deepEqual(await budgetFigures(t, item), expected)
      assert.deepEqual(await settlementFigures(t, ev, item), expected)
    }
    await same({ amount: 100000, actual: 0, committed: 0, available: 100000 })
    const { line } = await approvedLine(t, { eventId: ev, budgetItemId: item, amount: '30000' })
    await same({ amount: 100000, actual: 0, committed: 30000, available: 70000 })
    await paid(t, line, '10000', ev)
    await same({ amount: 100000, actual: 10000, committed: 20000, available: 70000 })
    await paid(t, line, '20000', ev)
    await same({ amount: 100000, actual: 30000, committed: 0, available: 70000 })
  }),
)

test(
  '결제가 승인 금액보다 크면 지출 예정은 0이고 음수가 되지 않는다. 지출을 취소하면 바로 지출 예정으로 돌아온다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { amount: '100000' })
    const { line } = await approvedLine(t, { eventId: null, budgetItemId: item, amount: '30000' })
    const over = await paid(t, line, '45000', null)
    assert.deepEqual(await budgetFigures(t, item), {
      amount: 100000,
      actual: 45000,
      committed: 0,
      available: 55000,
    })
    await t.pg.query('UPDATE expense SET cancelled_at = now() WHERE id = $1', [over])
    assert.deepEqual(await budgetFigures(t, item), {
      amount: 100000,
      actual: 0,
      committed: 30000,
      available: 70000,
    })
  }),
)

test(
  '대기·반려·승인 뒤 취소한 품목은 세지 않고, 일부만 승인한 요청의 승인 품목은 센다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { amount: '100000' })
    const target = { eventId: null, budgetItemId: item }
    await approvedLine(t, { ...target, amount: '1000' }, null)
    await approvedLine(t, { ...target, amount: '2000' }, 'rejected')
    await approvedLine(t, { ...target, amount: '4000' }, 'cancelled')
    // 품목 둘인 요청에서 하나만 승인하고 하나는 반려했다(요청 상태는 일부 승인)
    const { request } = await approvedLine(t, { ...target, amount: '8000' })
    const second = await t.make(t.council, 'line_item', {
      requestId: request,
      name: '테이프',
      quantity: 1,
      amount: '16000',
      budgetItemId: item,
    })
    await t.approve(second, 'rejected')
    assert.deepEqual(await budgetFigures(t, item), {
      amount: 100000,
      actual: 0,
      committed: 8000,
      available: 92000,
    })
    // 승인한 품목을 취소하면 바로 빠진다
    const { line } = await approvedLine(t, { ...target, amount: '32000' })
    assert.equal((await budgetFigures(t, item)).committed, 40000)
    await t.approve(line, 'cancelled')
    assert.equal((await budgetFigures(t, item)).committed, 8000)
  }),
)

test(
  '직접 이은 지출은 실제에 들고, 0원 항목에 승인하면 사용 가능이 음수다. 큰 금액도 정수 원 그대로다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const zero = await t.budgetItem(budget, { amount: '0', purpose: '영' })
    await approvedLine(t, { eventId: null, budgetItemId: zero, amount: '30000' })
    await t.expense({ amount: '5000', budgetItemId: zero })
    await t.expense({ amount: '700', budgetItemId: zero, cancelledAt: clockNow })
    assert.deepEqual(await budgetFigures(t, zero), {
      amount: 0,
      actual: 5000,
      committed: 30000,
      available: -35000,
    })
    const big = await t.budgetItem(budget, { amount: String(WON_MAX), purpose: '큰' })
    for (let i = 0; i < 3; i++)
      await approvedLine(t, { eventId: null, budgetItemId: big, amount: String(WON_MAX) })
    assert.deepEqual(await budgetFigures(t, big), {
      amount: WON_MAX,
      actual: 0,
      committed: 3 * WON_MAX,
      available: -2 * WON_MAX,
    })
  }),
)

test(
  '수입 항목은 들어온 돈만 있고 지출 예정과 사용 가능은 null이다',
  withSettlement(async t => {
    const ev = await t.event()
    const { budget, period } = await t.budgetOf()
    const item = await t.budgetItem(budget, { eventId: ev, type: 'income', amount: '30000' })
    await t.make(t.council, 'income', {
      fiscalPeriodId: period,
      source: 'donation',
      amount: '12000',
      receivedOn: '2026-10-21',
      budgetItemId: item,
    })
    const expected = { amount: 30000, actual: 12000, committed: null, available: null }
    assert.deepEqual(await budgetFigures(t, item), expected)
    assert.deepEqual(await settlementFigures(t, ev, item), expected)
  }),
)

test(
  '다른 기간 항목의 약정은 그 기간 항목에만 들고, 지금 기간 항목에는 섞이지 않는다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const current = await t.budgetItem(budget, { amount: '100000' })
    const earlier = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    const earlierBudget = await t.make(t.council, 'budget', { fiscalPeriodId: earlier })
    const old = await t.budgetItem(earlierBudget, { amount: '50000' })
    await approvedLine(t, { eventId: null, budgetItemId: old, amount: '20000' })
    assert.deepEqual(await budgetFigures(t, current), {
      amount: 100000,
      actual: 0,
      committed: 0,
      available: 100000,
    })
    assert.deepEqual(await budgetFigures(t, old, `?period=${earlier}`), {
      amount: 50000,
      actual: 0,
      committed: 20000,
      available: 30000,
    })
  }),
)

test(
  '다른 학생회의 품목·결제·지출은 우리 항목에 세지 않는다(학생회 거르기)',
  withSettlement(async t => {
    const ev = await t.event()
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { eventId: ev, amount: '100000' })
    const { line } = await approvedLine(t, { eventId: ev, budgetItemId: item, amount: '30000' })
    // 같은 학생회 확인이 막는 연결을 SQL로 억지로 만든다. 우리 것과 같은 모양과 금액이다.
    const theirs = await t.requestWithItem(null, {}, t.other)
    await t.pg.query('UPDATE line_item SET amount = $1, budget_item_id = $2 WHERE id = $3', [
      '30000',
      item,
      theirs.line,
    ])
    await t.approve(theirs.line, 'approved', t.other)
    const theirExpense = await t.expense({ amount: '10000' }, t.other)
    const theirPayment = await t.make(t.other, 'payment_line', {
      expenseId: theirExpense,
      lineItemId: theirs.line,
      amount: '10000',
    })
    await t.pg.query('UPDATE payment_line SET line_item_id = $1 WHERE id = $2', [
      line,
      theirPayment,
    ])
    const theirDirect = await t.expense({ amount: '7000' }, t.other)
    await t.pg.query('UPDATE expense SET budget_item_id = $1 WHERE id = $2', [item, theirDirect])
    const expected = { amount: 100000, actual: 0, committed: 30000, available: 70000 }
    assert.deepEqual(await budgetFigures(t, item), expected)
    assert.deepEqual(await settlementFigures(t, ev, item), expected)
  }),
)

test(
  '취소한 요청의 승인 품목은 지출 예정에 세지 않는다(정산 남은 것과 같은 기준)',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { amount: '100000' })
    await approvedLine(t, { eventId: null, budgetItemId: item, amount: '8000' })
    const gone = await approvedLine(t, { eventId: null, budgetItemId: item, amount: '30000' })
    assert.equal((await budgetFigures(t, item)).committed, 38000)
    // 결재된 요청은 취소하지 못하지만(409) 셈은 그 가정에 기대지 않는다.
    await t.pg.query('UPDATE request SET cancelled_at = now() WHERE id = $1', [gone.request])
    assert.deepEqual(await budgetFigures(t, item), {
      amount: 100000,
      actual: 0,
      committed: 8000,
      available: 92000,
    })
  }),
)
