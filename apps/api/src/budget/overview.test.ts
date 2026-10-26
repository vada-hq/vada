import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, FinanceOverview, FinanceOverviewResponse } from '@vada/contracts'
import { clockNow } from '../records/records.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 재정 첫 화면(DEC-92, 기능 024 조각 8). 숫자는 예산 셈(usage.ts)에서 오고, 같은 항목의 숫자는 예산 탭과 같다.
// 시험 묶음의 시계는 한국 2026-10-25 12:00, 기간은 2026-09-01 ~ 2027-02-28(budgetOf)이다.

const path = (t: SettlementKit, query = '') =>
  `/api/organizations/${t.council.councilId}/finance-overview${query}`

async function overviewOf(t: SettlementKit, query = '', user = 's-plain') {
  const response = await t.api.get(path(t, query), user)
  assert.equal(response.status, 200)
  return ((await response.json()) as FinanceOverviewResponse).overview
}

async function budgetRead(t: SettlementKit, query = '') {
  const response = await t.api.get(
    `/api/organizations/${t.council.councilId}/budget${query}`,
    's-plain',
  )
  assert.equal(response.status, 200)
  return (await response.json()) as BudgetResponse
}

// 승인한 품목 하나: 금액과 예산 항목은 승인할 때 채워진다(DEC-40).
async function approvedLine(
  t: SettlementKit,
  target: { eventId: string | null; budgetItemId: string; amount: string },
  owner = t.council,
) {
  const { request, line } = await t.requestWithItem(target.eventId, {}, owner)
  await t.pg.query('UPDATE line_item SET amount = $1, budget_item_id = $2 WHERE id = $3', [
    target.amount,
    target.budgetItemId,
    line,
  ])
  await t.approve(line, 'approved', owner)
  return { request, line }
}

const paidAt = (iso: string) => new Date(iso)

function cards(overview: FinanceOverview | null) {
  assert.ok(overview, '기간이 있으면 개요가 있다')
  const { total, sources, actual, committed, available, paidCount, committedCount, noItem } =
    overview
  return { total, sources, actual, committed, available, paidCount, committedCount, noItem }
}

test(
  '기간이 없으면 개요가 null이다. 모든 운영진이 읽고, 미인증은 401, 다른 학생회 사람은 403이다',
  withSettlement(async t => {
    assert.equal(await overviewOf(t), null)
    assert.equal((await t.api.get(path(t))).status, 401)
    assert.equal((await t.api.get(path(t), 'o-president')).status, 403)
  }),
)

test(
  '카드 넷: 총예산은 수입 예산 합, 실제 지출은 항목 실제 합과 항목 없는 지출, 지출 예정은 약정, 사용 가능은 그 차이다',
  withSettlement(async t => {
    const ev = await t.event({ name: '체육대회' })
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { type: 'income', purpose: '학생회비', amount: '300000' })
    await t.budgetItem(budget, { type: 'income', purpose: '지원금', amount: '200000' })
    const food = await t.budgetItem(budget, { eventId: ev, purpose: '식비', amount: '150000' })
    const misc = await t.budgetItem(budget, { purpose: '비품', amount: '100000' })
    // 승인 30,000 중 10,000 결제 → 실제 10,000, 예정 20,000
    const { line } = await approvedLine(t, { eventId: ev, budgetItemId: food, amount: '30000' })
    const part = await t.expense({ amount: '10000', eventId: ev })
    await t.pay(part, line, '10000')
    // 승인했지만 다 결제한 품목은 예정에 세지 않는다
    const full = await approvedLine(t, { eventId: null, budgetItemId: misc, amount: '5000' })
    const fullPay = await t.expense({ amount: '5000' })
    await t.pay(fullPay, full.line, '5000')
    // 직접 이은 지출, 항목 없는 지출(기간 안), 기간 밖 항목 없는 지출, 취소한 지출
    await t.expense({ amount: '7000', budgetItemId: misc })
    await t.expense({ amount: '3000' })
    await t.expense({ amount: '900', paidAt: paidAt('2026-08-20T03:00:00Z') })
    await t.expense({ amount: '800', budgetItemId: misc, cancelledAt: clockNow })
    const overview = await overviewOf(t)
    assert.deepEqual(cards(overview), {
      total: 500000,
      sources: ['지원금', '학생회비'],
      actual: 10000 + 5000 + 7000 + 3000,
      committed: 20000,
      available: 500000 - 25000 - 20000,
      paidCount: 4,
      committedCount: 1,
      noItem: 3000,
    })
    // 지출 예산 항목은 예산 탭과 숫자가 같고, 수입 항목은 없다
    const budgetItems = (await budgetRead(t)).items.filter(item => item.type === 'expense')
    assert.deepEqual(
      overview?.items.map(({ id, amount, actual, committed, available }) => ({
        id,
        amount,
        actual,
        committed,
        available,
      })),
      budgetItems.map(({ id, amount, actual, committed, available }) => ({
        id,
        amount,
        actual,
        committed,
        available,
      })),
    )
    assert.deepEqual(overview?.events, [
      {
        event: { id: ev, name: '체육대회' },
        amount: 150000,
        actual: 10000,
        committed: 20000,
        available: 120000,
      },
    ])
  }),
)

test(
  '최근 지출은 이 개요에 든 취소하지 않은 지출 가운데 결제일 늦은 3건이다',
  withSettlement(async t => {
    const ev = await t.event({ name: '체육대회' })
    const { budget } = await t.budgetOf()
    const misc = await t.budgetItem(budget, { purpose: '비품', amount: '100000' })
    await t.expense({
      description: '첫째',
      budgetItemId: misc,
      paidAt: paidAt('2026-09-02T03:00:00Z'),
    })
    await t.expense({ description: '둘째', paidAt: paidAt('2026-09-10T03:00:00Z') })
    await t.expense({
      description: '셋째',
      eventId: ev,
      budgetItemId: misc,
      paidAt: paidAt('2026-10-01T03:00:00Z'),
    })
    await t.expense({ description: '넷째', paidAt: paidAt('2026-10-20T03:00:00Z') })
    await t.expense({
      description: '취소',
      paidAt: paidAt('2026-10-21T03:00:00Z'),
      cancelledAt: clockNow,
    })
    await t.expense({ description: '기간 밖', paidAt: paidAt('2026-08-30T03:00:00Z') })
    const overview = await overviewOf(t)
    assert.deepEqual(
      overview?.recent.map(({ description, paidOn, event }) => ({ description, paidOn, event })),
      [
        { description: '넷째', paidOn: '2026-10-20', event: null },
        { description: '셋째', paidOn: '2026-10-01', event: { id: ev, name: '체육대회' } },
        { description: '둘째', paidOn: '2026-09-10', event: null },
      ],
    )
  }),
)

test(
  '항목에 든 지출은 결제일이 기간 밖이어도 그 항목의 기간에 센다(예산 탭과 같은 셈). 다른 기간 개요에는 없다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const earlier = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    const earlierBudget = await t.make(t.council, 'budget', { fiscalPeriodId: earlier })
    const old = await t.budgetItem(earlierBudget, { amount: '50000' })
    await t.budgetItem(budget, { amount: '100000' })
    // 지난 기간에 승인하고 이번 기간에 결제했다
    const { line } = await approvedLine(t, { eventId: null, budgetItemId: old, amount: '20000' })
    const late = await t.expense({ amount: '20000' })
    await t.pay(late, line, '20000')
    const before = cards(await overviewOf(t, `?period=${earlier}`))
    assert.equal(before.actual, 20000)
    assert.equal(before.committed, 0)
    assert.equal(before.paidCount, 1)
    const oldItem = (await budgetRead(t, `?period=${earlier}`)).items.find(item => item.id === old)
    assert.equal(oldItem?.actual, 20000)
    const now = cards(await overviewOf(t))
    assert.equal(now.actual, 0)
    assert.equal(now.paidCount, 0)
  }),
)

test(
  '다른 학생회의 기간은 404이고, 다른 학생회의 품목·지출은 세지 않는다(학생회 거르기)',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const theirs = await t.budgetOf(t.other)
    const item = await t.budgetItem(budget, { amount: '100000' })
    // 같은 학생회 확인이 막는 연결을 SQL로 억지로 만든다. 우리 것과 같은 모양과 금액이다.
    const their = await t.requestWithItem(null, {}, t.other)
    await t.pg.query('UPDATE line_item SET amount = $1, budget_item_id = $2 WHERE id = $3', [
      '30000',
      item,
      their.line,
    ])
    await t.approve(their.line, 'approved', t.other)
    const direct = await t.expense({ amount: '7000' }, t.other)
    await t.pg.query('UPDATE expense SET budget_item_id = $1 WHERE id = $2', [item, direct])
    await t.expense({ amount: '4000' }, t.other)
    assert.deepEqual(cards(await overviewOf(t)), {
      total: 0,
      sources: [],
      actual: 0,
      committed: 0,
      available: 0,
      paidCount: 0,
      committedCount: 0,
      noItem: 0,
    })
    assert.deepEqual((await overviewOf(t))?.recent, [])
    const response = await t.api.get(path(t, `?period=${theirs.period}`), 's-plain')
    assert.equal(response.status, 404)
  }),
)

test(
  '지출 예정 금액과 건수는 취소 요청·취소 품목·반려·초과 결제를 빼고, 지출 취소 시 함께 돌아온다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { amount: '100000' })
    const target = { eventId: null, budgetItemId: item, amount: '8000' }
    const gone = await approvedLine(t, target)
    await t.pg.query('UPDATE request SET cancelled_at = now() WHERE id = $1', [gone.request])
    const cancelled = await approvedLine(t, target)
    await t.approve(cancelled.line, 'cancelled')
    const rejected = await approvedLine(t, target)
    await t.approve(rejected.line, 'rejected')
    const over = await approvedLine(t, target)
    const payment = await t.expense({ amount: '9000' })
    await t.pay(payment, over.line, '9000')
    const before = cards(await overviewOf(t))
    assert.equal(before.committed, 0)
    assert.equal(before.committedCount, 0)
    await t.pg.query('UPDATE expense SET cancelled_at = now() WHERE id = $1', [payment])
    const after = cards(await overviewOf(t))
    assert.equal(after.committed, 8000)
    assert.equal(after.committedCount, 1)
    const budgetItem = (await budgetRead(t)).items.find(row => row.id === item)
    assert.equal(budgetItem?.committed, after.committed)
  }),
)

test(
  '항목 안 정한 지출은 한국 날짜의 시작 직전·끝 직후를 빼고 시작 0시·끝 23시 59분 59초를 센다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    await t.expense({ amount: '1000', paidAt: paidAt('2026-08-31T23:59:59+09:00') })
    await t.expense({ amount: '2000', paidAt: paidAt('2026-09-01T00:00:00+09:00') })
    await t.expense({ amount: '4000', paidAt: paidAt('2027-02-28T23:59:59+09:00') })
    await t.expense({ amount: '8000', paidAt: paidAt('2027-03-01T00:00:00+09:00') })
    const overview = await overviewOf(t, `?period=${period}`)
    const counted = cards(overview)
    assert.equal(counted.noItem, 6000)
    assert.equal(counted.actual, 6000)
    assert.equal(counted.paidCount, 2)
    assert.deepEqual(
      overview?.recent.map(row => row.amount),
      [4000, 2000],
    )
  }),
)
