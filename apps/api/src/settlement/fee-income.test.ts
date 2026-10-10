import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPlanResponse, EventFinanceResponse, IncomeResponse, RegistrationResponse } from '@vada/contracts'
import { feeIncomeDay, feeIncomeDescription } from '../incomes/service.js'
import { setupPurchases } from '../purchases/test-setup.js'
import { apply, confirm, create, entries, type Env, formBody, named, prepare, refused, registrationBase } from '../registrations/test-setup.js'

const financeOf = (env: Env, event = 'e') => env.ok<EventFinanceResponse>(env.request('GET', `/events/${event}/finance`))
const settle = (env: Env, version: number, feeIncomeLineId: string | null, event = 'e') =>
  env.request('POST', `/events/${event}/finance/settle`, { version, feeIncomeLineId })
const createPeriod = (env: Env, name: string, startsOn: string, endsOn: string) =>
  env.ok<BudgetPlanResponse>(env.request('POST', '/budget/periods', { name, startsOn, endsOn }), 201)
// 받은 편성을 그대로 다시 보내는 본문. 행사 예산은 보내지 않아 그대로 둔다. 바꿀 칸만 덮어쓴다.
const planBody = (plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) => ({ version: plan.period.version, name: plan.period.name,
  startsOn: plan.period.startsOn, endsOn: plan.period.endsOn, incomes: plan.incomes.map(({ id, name, amount }) => ({ id, name, amount })),
  operating: plan.operating.map(({ id, name, amount }) => ({ id, name, amount })),
  events: plan.events.map(({ eventId, version }) => ({ eventId, version })), ...overrides })
const save = (env: Env, plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) =>
  env.request('POST', `/budget/periods/${plan.period.id}/plan`, planBody(plan, overrides))

// 행사 e: 참가비 7,000원·납부자 0원. 김바다는 납부자, 이윤슬·박해랑은 입금 확인(박해랑은 그 뒤 운영진 취소), 최하나는 입금 전이다.
// 확인 시각은 DB now()라 받은 날을 보려고 정한다. 마지막 확인은 박해랑의 한국 2999-08-10 23:30이다. 끝나면 기획(p)으로 남는다.
async function charged(env: Env) {
  await prepare(env)
  const { form } = await create(env, { fee: 7000, memberFee: 0 })
  for (const [name, studentId] of [['김바다', '2022000001'], ['이윤슬', '2023000003'], ['박해랑', '2023000004'], ['최하나', '2023000005']] as const) {
    await apply(env, form!.code, name, studentId)
  }
  const list = await entries(env)
  await env.ok(confirm(env, named(list, '이윤슬').id))
  await env.ok(confirm(env, named(list, '박해랑').id))
  await env.ok(env.request('POST', `${registrationBase}/entries/${named(list, '박해랑').id}/cancel`, {}))
  await env.pg.query(`UPDATE registrations SET paid_at = CASE WHEN id = $1 THEN '2999-08-03T12:00+09'::timestamptz
    ELSE '2999-08-10T23:30+09'::timestamptz END WHERE paid_at IS NOT NULL`, [named(list, '이윤슬').id])
  return list
}
// 재정(f)이 '2999년 1학기'(수입 줄 학생회비·행사 참가비, 운영 줄 회의비)에 행사 e를 넣고, '2999년 2학기'(수입 줄 후원)를 만든다.
async function periods(env: Env) {
  env.as('f')
  const spring = await env.ok<BudgetPlanResponse>(save(env, await createPeriod(env, '2999년 1학기', '2999-03-01', '2999-08-31'), {
    incomes: [{ id: null, name: '학생회비', amount: 500000 }, { id: null, name: '행사 참가비', amount: 30000 }],
    operating: [{ id: null, name: '회의비', amount: 10000 }], events: [{ eventId: 'e', version: 0 }] }))
  const autumn = await env.ok<BudgetPlanResponse>(save(env, await createPeriod(env, '2999년 2학기', '2999-09-01', '2999-12-31'), {
    incomes: [{ id: null, name: '후원', amount: 1000 }] }))
  return { spring, autumn, feeLine: spring.incomes.find(line => line.name === '행사 참가비')! }
}

test('참가비 수입 내용은 100자 안이고, 받은 날은 마지막 입금 확인의 한국 날짜를 기간 안으로 당긴다', () => {
  assert.equal(feeIncomeDescription('체육대회'), '체육대회 참가비')
  const long = feeIncomeDescription('가'.repeat(100))
  assert.deepEqual([[...long].length, long.endsWith('… 참가비'), long.startsWith('가'.repeat(95))], [100, true, true])
  assert.equal(feeIncomeDescription('가'.repeat(96)), `${'가'.repeat(96)} 참가비`)
  assert.equal([...feeIncomeDescription(`${'가'.repeat(99)}😀`)].length, 100)
  const period = { startsOn: '2999-03-01', endsOn: '2999-08-31' }
  // 한국 2999-08-10 23:30 = UTC 14:30
  assert.equal(feeIncomeDay(new Date('2999-08-10T14:30:00Z'), period), '2999-08-10')
  // 한국 9월 1일 0시는 기간 뒤라 끝일이다.
  assert.equal(feeIncomeDay(new Date('2999-08-31T15:00:00Z'), period), '2999-08-31')
  assert.equal(feeIncomeDay(new Date('2999-02-27T00:00:00Z'), period), '2999-03-01')
})

test('재정 탭: 받은 참가비·입금 확인 수·입금 전을 세고, 기간이 없으면 정산하지 못한다', async () => {
  const env = await setupPurchases()
  try {
    await charged(env)
    env.as('f')
    const before = (await financeOf(env)).finance
    assert.deepEqual([before.fees, before.period, before.feeIncome], [{ received: 14000, count: 2, unpaid: 1 }, null, null])
    await refused(settle(env, 0, null), 409, 'NOT_READY_TO_SETTLE')
    const { spring } = await periods(env)
    assert.deepEqual((await financeOf(env)).finance.period,
      { id: spring.period.id, name: '2999년 1학기', incomes: spring.incomes.map(({ id, name }) => ({ id, name })) })
    // 참가 신청이 없거나, 무료이고 입금 확인이 없는 신청에는 참가비 숫자가 없다.
    assert.equal((await financeOf(env, 'e2')).finance.fees, null)
    env.as('p')
    await env.ok(env.request('PATCH', '/events/e2', { version: 1, startsAt: '2999-08-21T10:00', endsAt: '2999-08-21T18:00', place: '강당' }))
    await env.ok(env.request('POST', '/events/e2/registration', formBody()), 201)
    env.as('f')
    assert.equal((await financeOf(env, 'e2')).finance.fees, null)
  } finally { await env.pg.close() }
})

test('정산: 고른 수입 줄로 받은 참가비 한 건을 넣고 처리 기록에 남긴다', async () => {
  const env = await setupPurchases()
  try {
    await charged(env)
    const { spring, autumn, feeLine } = await periods(env)
    for (const lineId of [spring.operating[0]!.id, autumn.incomes[0]!.id, 'missing']) {
      await refused(settle(env, 0, lineId), 409, 'BUDGET_LINE_INVALID', lineId)
    }
    const { finance } = await env.ok<EventFinanceResponse>(settle(env, 0, feeLine.id))
    assert.deepEqual(finance.feeIncome, { id: finance.feeIncome!.id, amount: 14000, period: { id: spring.period.id, name: '2999년 1학기' },
      line: { id: feeLine.id, name: '행사 참가비' } })
    assert.deepEqual(finance.history.at(-1)!.changes, { budget: null, spent: 0, expenseCount: 0,
      fee: { amount: 14000, count: 2, period: '2999년 1학기', line: '행사 참가비' } })
    const plan = await env.ok<BudgetPlanResponse>(env.request('GET', `/budget/periods/${spring.period.id}`))
    const income = plan.incomeRecords.find(record => record.id === finance.feeIncome!.id)!
    assert.deepEqual([income.description, income.amount, income.receivedOn, income.note, income.recordedBy.name, income.budgetLine, income.carriedFrom],
      ['체육대회 참가비', 14000, '2999-08-10', '입금 확인 2명', '재정', { id: feeLine.id, name: '행사 참가비' }, null])
    assert.deepEqual([plan.incomes.find(line => line.id === feeLine.id)!.received, plan.totals.received], [14000, 14000])
  } finally { await env.pg.close() }
})

test('다시 열기: 참가비 수입을 취소하고, 입금을 더 확인한 뒤 다시 정산하면 새 금액으로 하나만 넣는다', async () => {
  const env = await setupPurchases()
  try {
    const list = await charged(env)
    const { spring, feeLine } = await periods(env)
    const settled = (await env.ok<EventFinanceResponse>(settle(env, 0, feeLine.id))).finance
    const reopened = (await env.ok<EventFinanceResponse>(env.request('POST', '/events/e/finance/reopen',
      { version: settled.version, reason: '입금 더 받음' }))).finance
    assert.equal(reopened.feeIncome, null)
    const voided = (await env.ok<IncomeResponse>(env.request('GET', `/budget/periods/${spring.period.id}/incomes/${settled.feeIncome!.id}`))).income
    assert.deepEqual([voided.voided?.reason, voided.history.at(-1)?.action], ['체육대회 정산을 다시 열었어요', 'voided'])
    env.as('p')
    await env.ok(confirm(env, named(list, '최하나').id))
    env.as('f')
    const again = (await env.ok<EventFinanceResponse>(settle(env, reopened.version, null))).finance
    assert.deepEqual([again.feeIncome?.amount, again.feeIncome?.line, again.fees], [21000, null, { received: 21000, count: 3, unpaid: 0 }])
    const { rows } = await env.pg.query<{ note: string }>("SELECT note FROM incomes WHERE event_id = 'e' AND voided_at IS NULL")
    assert.deepEqual(rows, [{ note: '입금 확인 3명' }])
  } finally { await env.pg.close() }
})

test('받은 참가비가 0원이면 기간 없이 정산하고 수입을 만들지 않는다. 행사 이름이 100자여도 넣는다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000 })
    env.as('f')
    // 신청자가 없는 참가비 신청은 입금 전도 0명이다.
    assert.deepEqual((await financeOf(env)).finance.fees, { received: 0, count: 0, unpaid: 0 })
    env.as('p')
    await apply(env, form!.code, '이윤슬', '2023000003')
    env.as('f')
    assert.deepEqual((await financeOf(env)).finance.fees, { received: 0, count: 0, unpaid: 1 })
    const free = (await env.ok<EventFinanceResponse>(settle(env, 0, null))).finance
    assert.deepEqual([free.settled?.by.name, free.feeIncome, free.history.at(-1)!.changes.fee], ['재정', null, null])
    assert.deepEqual((await env.pg.query<{ count: number }>('SELECT count(*)::int AS count FROM incomes')).rows, [{ count: 0 }])

    await env.pg.query("UPDATE events SET name = $1 WHERE id = 'e2'", ['가'.repeat(100)])
    env.as('p')
    await env.ok(env.request('PATCH', '/events/e2', { version: 1, startsAt: '2999-08-21T10:00', endsAt: '2999-08-21T18:00', place: '강당' }))
    const { form: other } = await env.ok<RegistrationResponse>(env.request('POST', '/events/e2/registration', formBody({ fee: 5000 })), 201)
    await apply(env, other!.code, '박해랑', '2023000004')
    const [entry] = (await env.ok<RegistrationResponse>(env.request('GET', '/events/e2/registration'))).registrations
    await env.ok(env.request('POST', `/events/e2/registration/entries/${entry!.id}/payment`, {}))
    env.as('f')
    const period = await createPeriod(env, '2999년 1학기', '2999-03-01', '2999-08-31')
    await env.ok(save(env, period, { events: [{ eventId: 'e2', version: 0 }] }))
    const long = (await env.ok<EventFinanceResponse>(settle(env, 0, null, 'e2'))).finance
    const { rows: [income] } = await env.pg.query<{ description: string }>('SELECT description FROM incomes WHERE id = $1', [long.feeIncome!.id])
    assert.deepEqual([[...income!.description].length, income!.description.endsWith('… 참가비')], [100, true])
  } finally { await env.pg.close() }
})
