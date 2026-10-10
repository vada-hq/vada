import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPeriodsResponse, BudgetPlanResponse, ExpenseResponse, IncomeResponse } from '@vada/contracts'
import { BUDGET_EVENTS_MAX, BUDGET_INCOME_LINES_MAX, BUDGET_LINE_NAME_MAX, BUDGET_OPERATING_LINES_MAX, BUDGET_PERIOD_NAME_MAX,
  SaveBudgetPlanSchema, type EventFinanceResponse } from '@vada/contracts'
import { MAX_BODY_BYTES } from '../http/guard.js'
import { readBook } from '../workbook/read-book.js'
import { createBudgetService } from './service.js'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const periodBody = (overrides: Record<string, unknown> = {}) => ({ name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28', ...overrides })
const createPeriod = async (env: Env, overrides: Record<string, unknown> = {}) =>
  env.ok<BudgetPlanResponse>(env.request('POST', '/budget/periods', periodBody(overrides)), 201)
const planOf = (env: Env, periodId: string) => env.ok<BudgetPlanResponse>(env.request('GET', `/budget/periods/${periodId}`))
// 지출 기록 본문. 기본은 상시 운영이다.
const expenseBody = (overrides: Record<string, unknown> = {}) => ({ eventId: null, vendor: '다이소', description: '회의 다과', amount: 12000,
  paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] as string[], budgetLineId: null, ...overrides })
const record = async (env: Env, overrides: Record<string, unknown> = {}) =>
  (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', expenseBody(overrides)), 201)).expense
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}

test('기간 만들기: 재정 권한자만 만들고, 날짜가 겹치거나 이름이 같으면 막으며, 목록은 시작일이 늦은 순이다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await request('POST', '/budget/periods', periodBody())).status, 403, user)
    }
    as(null)
    assert.equal((await request('POST', '/budget/periods', periodBody())).status, 401)
    as('f')
    const autumn = await createPeriod(env)
    assert.deepEqual(autumn.period, { id: autumn.period.id, name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28', version: 1,
      closed: null })
    assert.deepEqual(autumn.history.map(entry => [entry.action, entry.actor.name, entry.changes]),
      [['created', '재정', { name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' }]])
    as('l')
    const spring = await createPeriod(env, { name: '2026년 1학기', startsOn: '2026-03-01', endsOn: '2026-08-31' })
    await refused(request('POST', '/budget/periods', periodBody({ name: '겹침', startsOn: '2027-02-28', endsOn: '2027-03-31' })), 409, 'PERIOD_OVERLAP')
    await refused(request('POST', '/budget/periods', periodBody({ startsOn: '2027-03-01', endsOn: '2027-08-31' })), 409, 'PERIOD_NAME_TAKEN')
    as('p')
    const { periods } = await ok<BudgetPeriodsResponse>(request('GET', '/budget/periods'))
    assert.deepEqual(periods.map(period => [period.id, period.name, period.operating]),
      [[autumn.period.id, '2026년 2학기', []], [spring.period.id, '2026년 1학기', []]])
    // 다른 학생회의 기간은 없는 것으로 본다.
    await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('pb','b','B 기간','2026-09-01','2027-02-28','x')`)
    for (const id of ['pb', 'missing', 'x'.repeat(65)]) assert.equal((await request('GET', `/budget/periods/${id}`)).status, 404, id)
    as('x')
    assert.equal((await request('GET', '/budget/periods')).status, 403)
  } finally { await pg.close() }
})

test('편성 읽기: 줄·숫자·후보·알림을 준다. 행사 줄은 행사 재정과 같은 정의이고 운영 줄은 고른 지출만 센다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    await env.approved()
    as('f')
    const { period } = await createPeriod(env)
    // 편성 저장(Task 6) 전이므로 줄은 표에 바로 넣는다.
    await pg.exec(`
      INSERT INTO budget_lines (id,organization_id,period_id,kind,event_id,name,amount,position) VALUES
        ('li','a','${period.id}','income',NULL,'학생회비',800000,0),
        ('lo1','a','${period.id}','operating',NULL,'회의비',100000,0),
        ('lo2','a','${period.id}','operating',NULL,'소모품',50000,1),
        ('le','a','${period.id}','event','e',NULL,NULL,0);
    `)
    await ok(request('POST', '/events/e/finance/budget', { version: 0, budget: 300000 }))
    await record(env, { eventId: 'e', amount: 50000 })
    // 행사 지출은 결제일과 상관없이 그 행사 줄로 센다.
    await record(env, { eventId: 'e', amount: 7000, paidOn: '2027-03-05' })
    const voided = await record(env, { eventId: 'e', amount: 9000 })
    await ok(request('POST', `/expenses/${voided.id}/void`, { version: 1, reason: '중복' }))
    await record(env, { budgetLineId: 'lo1' })
    await record(env, { amount: 3000, paidOn: '2026-11-01' })
    await record(env, { amount: 4000, paidOn: '2026-08-31' })
    await record(env, { eventId: 'e2', amount: 6000 })
    as('p')
    const plan = await planOf(env, period.id)
    assert.deepEqual(plan.incomes, [{ id: 'li', name: '학생회비', amount: 800000, received: 0, incomeCount: 0 }])
    // 가짜 생성기의 승인 품목은 수량 2, 예상 단가 11,590원이다.
    assert.deepEqual(plan.events, [{ eventId: 'e', name: '체육대회', budget: 300000, spent: 57000, planned: 23180, plannedUnknown: 0,
      remaining: 219820, settled: false, version: 1 }])
    assert.deepEqual(plan.operating, [{ id: 'lo1', name: '회의비', amount: 100000, spent: 12000, remaining: 88000, expenseCount: 1 },
      { id: 'lo2', name: '소모품', amount: 50000, spent: 0, remaining: 50000, expenseCount: 0 }])
    assert.deepEqual(plan.unassigned, { spent: 3000, count: 1 })
    assert.deepEqual(plan.totals, { income: 800000, received: 0, budget: 450000, undecided: 0, spent: 72000, planned: 23180, plannedUnknown: 0,
      remaining: 450000 - 72000 - 23180, balance: -72000 })
    assert.deepEqual([plan.unassignedIncome, plan.incomeRecords, plan.incomeRecordsTruncated], [{ received: 0, count: 0 }, [], false])
    assert.deepEqual(plan.candidates, [{ eventId: 'e2', name: '축제', budget: null, version: 0, settled: false, spent: 6000 }])
    assert.deepEqual(plan.notices, { eventsWithSpending: 1, operatingOutside: 1 })
  } finally { await pg.close() }
})

// 받은 편성을 그대로 다시 보내는 본문. 바꿀 칸만 덮어쓴다.
const planBody = (plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) => ({ version: plan.period.version, name: plan.period.name,
  startsOn: plan.period.startsOn, endsOn: plan.period.endsOn, incomes: plan.incomes.map(({ id, name, amount }) => ({ id, name, amount })),
  operating: plan.operating.map(({ id, name, amount }) => ({ id, name, amount })),
  events: plan.events.map(({ eventId, version, budget }) => ({ eventId, version, budget })), ...overrides })
const save = (env: Env, plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) =>
  env.request('POST', `/budget/periods/${plan.period.id}/plan`, planBody(plan, overrides))

test('편성 저장: 줄을 더하고 바꾸고 지우며, 보낸 순서를 지키고, 바뀐 것만 기록한다', async () => {
  const env = await setupPurchases()
  const { pg, ok, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    plan = await ok<BudgetPlanResponse>(save(env, plan, {
      incomes: [{ id: null, name: '학생회비', amount: 800000 }, { id: null, name: '이월금', amount: 120000 }],
      operating: [{ id: null, name: '회의비', amount: 100000 }, { id: null, name: '예비비', amount: 50000 }],
    }))
    assert.equal(plan.period.version, 2)
    assert.deepEqual(plan.incomes.map(line => [line.name, line.amount]), [['학생회비', 800000], ['이월금', 120000]])
    const [fees, carried] = plan.incomes
    const [meeting, reserve] = plan.operating
    plan = await ok<BudgetPlanResponse>(save(env, plan, {
      name: '2026 가을', incomes: [{ id: carried!.id, name: '전기 이월금', amount: 120000 }, { id: fees!.id, name: '학생회비', amount: 750000 }],
      operating: [{ id: reserve!.id, name: '예비비', amount: 50000 }],
    }))
    assert.deepEqual(plan.incomes.map(line => [line.id, line.name, line.amount]), [[carried!.id, '전기 이월금', 120000], [fees!.id, '학생회비', 750000]])
    assert.deepEqual(plan.operating.map(line => line.id), [reserve!.id])
    assert.deepEqual(plan.history.at(-1)!.changes, { name: { from: '2026년 2학기', to: '2026 가을' }, lines: [
      { group: 'income', action: 'changed', name: '전기 이월금', previousName: '이월금', from: 120000, to: 120000 },
      { group: 'income', action: 'changed', name: '학생회비', from: 800000, to: 750000 },
      { group: 'operating', action: 'removed', name: '회의비', from: 100000 },
    ] })
    // 바뀐 것이 없으면 버전과 기록을 그대로 둔다.
    const same = await ok<BudgetPlanResponse>(save(env, plan))
    assert.deepEqual([same.period.version, same.history.length], [plan.period.version, plan.history.length])
    await refused(save(env, plan, { version: plan.period.version - 1 }), 409, 'VERSION_CONFLICT')
    // 다른 기간의 줄이나 없는 줄 ID는 없는 것으로 본다.
    await refused(save(env, plan, { incomes: [{ id: meeting!.id, name: '되살림', amount: 1 }] }), 404, 'NOT_FOUND')
    // 수입 줄 ID를 운영 줄로 보내도 없는 것으로 본다(양쪽에 같은 ID를 보내면 계약이 먼저 막는다).
    await refused(save(env, plan, { incomes: [{ id: carried!.id, name: '전기 이월금', amount: 120000 }], operating: [{ id: fees!.id, name: '옮김', amount: 1 }] }),
      404, 'NOT_FOUND')
    assert.equal((await pg.query('SELECT 1 FROM budget_lines WHERE id = $1', [meeting!.id])).rows.length, 0)
  } finally { await pg.close() }
})

test('편성 저장: 행사를 넣고 빼며, 바꾼 행사 예산은 행사 처리 기록에도 남고, 다른 기간·정산된 행사·버전을 지킨다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    as('f')
    let autumn = await createPeriod(env)
    const spring = await createPeriod(env, { name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' })
    autumn = await ok<BudgetPlanResponse>(save(env, autumn, { events: [{ eventId: 'e', version: 0, budget: 300000 }, { eventId: 'e2', version: 0, budget: null }] }))
    assert.deepEqual(autumn.events.map(line => [line.eventId, line.budget, line.version]), [['e', 300000, 1], ['e2', null, 0]])
    assert.deepEqual(autumn.candidates, [])
    assert.deepEqual(autumn.history.at(-1)!.changes, { lines: [{ group: 'event', action: 'added', name: '체육대회', to: 300000 },
      { group: 'event', action: 'added', name: '축제', to: null }] })
    const finance = await ok<EventFinanceResponse>(request('GET', '/events/e/finance'))
    assert.deepEqual(finance.finance.history.map(entry => [entry.action, entry.actor.name, entry.changes]), [['budget_set', '재정', { from: null, to: 300000 }]])
    await refused(save(env, spring, { events: [{ eventId: 'e', version: 1, budget: 300000 }] }), 409, 'EVENT_IN_OTHER_PERIOD')
    await refused(save(env, autumn, { events: [...planBody(autumn).events, { eventId: 'ex', version: 0, budget: null }] }), 404, 'NOT_FOUND')
    // 행사 재정 탭에서 예산이 바뀌면, 그 줄을 옛 버전으로 바꾸려 할 때만 막는다.
    await ok(request('POST', '/events/e/finance/budget', { version: 1, budget: 400000 }))
    await refused(save(env, autumn, { events: [{ eventId: 'e', version: 1, budget: 350000 }, { eventId: 'e2', version: 0, budget: null }] }),
      409, 'VERSION_CONFLICT', '행사 예산 버전')
    autumn = await planOf(env, autumn.period.id)
    // 정산된 행사는 예산을 바꿀 수 없고, 그대로 두면 통과한다.
    await ok(request('POST', '/events/e2/finance/settle', { version: 0 }))
    autumn = await planOf(env, autumn.period.id)
    await refused(save(env, autumn, { events: [{ eventId: 'e', version: 2, budget: 400000 }, { eventId: 'e2', version: 1, budget: 1000 }] }),
      409, 'EVENT_SETTLED')
    autumn = await ok<BudgetPlanResponse>(save(env, autumn, { events: [{ eventId: 'e2', version: 1, budget: null }] }))
    assert.deepEqual(autumn.events.map(line => [line.eventId, line.settled]), [['e2', true]])
    assert.deepEqual(autumn.candidates.map(candidate => [candidate.eventId, candidate.budget]), [['e', 400000]])
    assert.deepEqual(autumn.history.at(-1)!.changes, { lines: [{ group: 'event', action: 'removed', name: '체육대회', from: 400000 }] })
    // 뺀 행사는 다른 기간에 넣을 수 있다.
    const moved = await ok<BudgetPlanResponse>(save(env, spring, { events: [{ eventId: 'e', version: 2, budget: 400000 }] }))
    assert.deepEqual(moved.events.map(line => line.eventId), ['e'])
  } finally { await pg.close() }
})

test('편성 저장: 지출이 고른 운영 줄은 지울 수 없고, 취소한 지출만 고른 줄은 지우면서 표시를 지운다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    plan = await ok<BudgetPlanResponse>(save(env, plan, { operating: [{ id: null, name: '회의비', amount: 100000 }, { id: null, name: '소모품', amount: 50000 }] }))
    const [meeting, supplies] = plan.operating
    await record(env, { budgetLineId: meeting!.id })
    const voided = await record(env, { amount: 2000, budgetLineId: supplies!.id })
    await ok(request('POST', `/expenses/${voided.id}/void`, { version: 1, reason: '중복' }))
    plan = await planOf(env, plan.period.id)
    assert.deepEqual(plan.operating.map(line => [line.name, line.expenseCount]), [['회의비', 1], ['소모품', 0]])
    await refused(save(env, plan, { operating: [{ id: supplies!.id, name: '소모품', amount: 50000 }] }), 409, 'LINE_IN_USE')
    plan = await ok<BudgetPlanResponse>(save(env, plan, { operating: [{ id: meeting!.id, name: '회의비', amount: 100000 }] }))
    assert.deepEqual(plan.operating.map(line => line.name), ['회의비'])
    const { rows } = await pg.query<{ budget_line_id: string | null }>('SELECT budget_line_id FROM expenses WHERE id = $1', [voided.id])
    assert.equal(rows[0]!.budget_line_id, null)
  } finally { await pg.close() }
})

test('편성 저장: 날짜를 바꾸면 다른 기간과 겹치지 않아야 하고, 운영 항목을 고른 지출이 기간 밖으로 나가지 않아야 한다', async () => {
  const env = await setupPurchases()
  const { pg, ok, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    await createPeriod(env, { name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' })
    plan = await ok<BudgetPlanResponse>(save(env, plan, { operating: [{ id: null, name: '회의비', amount: 100000 }] }))
    await record(env, { paidOn: '2026-10-09', budgetLineId: plan.operating[0]!.id })
    await refused(save(env, plan, { endsOn: '2027-03-01' }), 409, 'PERIOD_OVERLAP')
    await refused(save(env, plan, { name: '2027년 1학기' }), 409, 'PERIOD_NAME_TAKEN')
    await refused(save(env, plan, { startsOn: '2026-10-10' }), 409, 'EXPENSES_OUTSIDE_PERIOD')
    const shorter = await ok<BudgetPlanResponse>(save(env, plan, { endsOn: '2027-01-31' }))
    assert.deepEqual([shorter.period.endsOn, shorter.history.at(-1)!.changes], ['2027-01-31', { endsOn: { from: '2027-02-28', to: '2027-01-31' } }])
  } finally { await pg.close() }
})

test('편성 저장: 재정 권한자만 하고, 다른 학생회의 기간은 없는 것으로 본다', async () => {
  const env = await setupPurchases()
  const { pg, request, as } = env
  try {
    as('f')
    const plan = await createPeriod(env)
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await save(env, plan)).status, 403, user)
    }
    as(null)
    assert.equal((await save(env, plan)).status, 401)
    as('f')
    await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('pb','b','B 기간','2027-03-01','2027-08-31','x')`)
    assert.equal((await request('POST', '/budget/periods/pb/plan', planBody(plan))).status, 404)
  } finally { await pg.close() }
})

test('상한을 채운 편성 본문도 공통 가드의 크기 안에 들고 스키마를 통과한다', () => {
  const id = (n: number) => String(n).padStart(64, 'i')
  const line = (n: number) => ({ id: id(n), name: `${'😀'.repeat(BUDGET_LINE_NAME_MAX - 3)}${String(n).padStart(3, '0')}`, amount: 2147483647 })
  const body = { version: 2147483647, name: '😀'.repeat(BUDGET_PERIOD_NAME_MAX), startsOn: '2026-09-01', endsOn: '2027-02-28',
    incomes: Array.from({ length: BUDGET_INCOME_LINES_MAX }, (_, n) => line(n)),
    operating: Array.from({ length: BUDGET_OPERATING_LINES_MAX }, (_, n) => line(100 + n)),
    events: Array.from({ length: BUDGET_EVENTS_MAX }, (_, n) => ({ eventId: id(200 + n), version: 2147483647, budget: 2147483647 })) }
  assert.equal(SaveBudgetPlanSchema.safeParse(body).success, true)
  assert.ok(Buffer.byteLength(JSON.stringify(body)) <= MAX_BODY_BYTES, `${Buffer.byteLength(JSON.stringify(body))} bytes`)
})

test('편성 저장: 행사 재정 탭에서 바뀐 행사 줄은 금액을 보내지 않으면 버전을 보지 않고 그대로 둔다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    plan = await ok<BudgetPlanResponse>(save(env, plan, { events: [{ eventId: 'e', version: 0, budget: 300000 }, { eventId: 'e2', version: 0 }] }))
    as('l')
    await ok(request('POST', '/events/e/finance/budget', { version: 1, budget: 400000 }))
    as('f')
    // 처음 받은 편성(e는 버전 1)에 수입 줄만 더한다. 행사 줄은 금액을 보내지 않는다.
    const saved = await ok<BudgetPlanResponse>(save(env, plan, { incomes: [{ id: null, name: '학생회비', amount: 800000 }],
      events: [{ eventId: 'e', version: 1 }, { eventId: 'e2', version: 0 }] }))
    assert.deepEqual(saved.events.map(line => [line.eventId, line.budget, line.version]), [['e', 400000, 2], ['e2', null, 0]])
    assert.deepEqual(saved.history.at(-1)!.changes, { lines: [{ group: 'income', action: 'added', name: '학생회비', to: 800000 }] })
    // 그 줄의 금액을 옛 버전으로 바꾸려 하면 막는다.
    await refused(save(env, saved, { events: [{ eventId: 'e', version: 1, budget: 350000 }, { eventId: 'e2', version: 0 }] }), 409, 'VERSION_CONFLICT')
  } finally { await pg.close() }
})

// 수입 기록 본문. 기본은 수입 항목이 없는 수입이다.
const incomeBody = (overrides: Record<string, unknown> = {}) => ({ description: '학생회비 입금', amount: 500000, receivedOn: '2026-09-15',
  budgetLineId: null, note: null, ...overrides })
const recordIncome = async (env: Env, periodId: string, overrides: Record<string, unknown> = {}) =>
  (await env.ok<IncomeResponse>(env.request('POST', `/budget/periods/${periodId}/incomes`, incomeBody(overrides)), 201)).income

test('편성 읽기: 수입 줄마다 실제 수입과 건수, 항목 없는 수입, 실제 수입과 남은 돈, 이 기간의 수입 내역을 준다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    const spring = await createPeriod(env, { name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' })
    plan = await ok<BudgetPlanResponse>(save(env, plan, { incomes: [{ id: null, name: '학생회비', amount: 800000 }, { id: null, name: '지원금', amount: 200000 }] }))
    const [fees, grant] = plan.incomes
    await recordIncome(env, plan.period.id, { budgetLineId: fees!.id, receivedOn: '2026-09-02' })
    await recordIncome(env, plan.period.id, { budgetLineId: fees!.id, amount: 250000, receivedOn: '2026-10-02' })
    const voided = await recordIncome(env, plan.period.id, { budgetLineId: grant!.id, amount: 200000 })
    await ok(request('POST', `/budget/periods/${plan.period.id}/incomes/${voided.id}/void`, { version: 1, reason: '잘못 입력' }))
    await recordIncome(env, plan.period.id, { amount: 30000, description: '후원금', receivedOn: '2026-10-02' })
    await recordIncome(env, spring.period.id, { amount: 9000, receivedOn: '2027-03-02' })
    await record(env, { amount: 12000 })
    as('p')
    const read = await planOf(env, plan.period.id)
    assert.deepEqual(read.incomes.map(line => [line.name, line.amount, line.received, line.incomeCount]),
      [['학생회비', 800000, 750000, 2], ['지원금', 200000, 0, 0]])
    assert.deepEqual(read.unassignedIncome, { received: 30000, count: 1 })
    assert.deepEqual([read.totals.received, read.totals.spent, read.totals.balance], [780000, 12000, 768000])
    // 받은 날 최근 순이고, 같은 날이면 나중에 기록한 것이 먼저다. 취소한 수입도 준다.
    assert.deepEqual(read.incomeRecords.map(income => [income.description, income.amount, income.voided !== null]),
      [['후원금', 30000, false], ['학생회비 입금', 250000, false], ['학생회비 입금', 200000, true], ['학생회비 입금', 500000, false]])
    assert.equal(read.incomeRecordsTruncated, false)
  } finally { await pg.close() }
})

test('편성 읽기: 수입 내역은 최근 300건만 주고 잘렸다고 알린다. 합계는 잘린 것까지 센다', async () => {
  const env = await setupPurchases()
  const { pg, as } = env
  try {
    as('f')
    const plan = await createPeriod(env)
    await pg.exec(`INSERT INTO incomes (id,organization_id,period_id,description,amount,received_on,recorded_by)
      SELECT 'bulk-' || lpad(n::text, 3, '0'), 'a', '${plan.period.id}', '입금', 1000, DATE '2026-09-01' + n, 'f' FROM generate_series(1, 301) AS n`)
    const read = await planOf(env, plan.period.id)
    assert.deepEqual([read.incomeRecords.length, read.incomeRecordsTruncated, read.totals.received], [300, true, 301000])
    // 받은 날이 가장 이른 한 건(9/2)이 잘린다.
    assert.equal(read.incomeRecords.at(-1)!.receivedOn, '2026-09-03')
  } finally { await pg.close() }
})

test('편성 저장: 수입이 고른 수입 줄은 지울 수 없고, 수입이 기간 밖으로 나가는 날짜 변경은 막는다. 취소한 수입은 보지 않는다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    plan = await ok<BudgetPlanResponse>(save(env, plan, { incomes: [{ id: null, name: '학생회비', amount: 800000 }, { id: null, name: '지원금', amount: 200000 }] }))
    const [fees, grant] = plan.incomes
    const used = await recordIncome(env, plan.period.id, { budgetLineId: grant!.id, receivedOn: '2026-09-10' })
    const voided = await recordIncome(env, plan.period.id, { budgetLineId: fees!.id, receivedOn: '2026-09-02' })
    await ok(request('POST', `/budget/periods/${plan.period.id}/incomes/${voided.id}/void`, { version: 1, reason: '중복' }))
    await recordIncome(env, plan.period.id, { receivedOn: '2027-02-20' })
    plan = await planOf(env, plan.period.id)
    assert.deepEqual(plan.incomes.map(line => [line.name, line.incomeCount]), [['학생회비', 0], ['지원금', 1]])
    await refused(save(env, plan, { incomes: [{ id: fees!.id, name: '학생회비', amount: 800000 }] }), 409, 'LINE_IN_USE')
    // 취소한 수입만 고른 줄은 지우고, 그 수입의 항목 표시도 지운다.
    plan = await ok<BudgetPlanResponse>(save(env, plan, { incomes: [{ id: grant!.id, name: '지원금', amount: 200000 }] }))
    assert.deepEqual(plan.incomes.map(line => line.name), ['지원금'])
    const { rows } = await pg.query<{ budget_line_id: string | null }>('SELECT budget_line_id FROM incomes WHERE id = $1', [voided.id])
    assert.equal(rows[0]!.budget_line_id, null)
    // 취소한 수입(9/2)만 밖으로 나가면 통과한다.
    plan = await ok<BudgetPlanResponse>(save(env, plan, { startsOn: '2026-09-03' }))
    assert.equal(plan.period.startsOn, '2026-09-03')
    // 항목이 있는 수입(9/10)이나 없는 수입(2/20)이 밖으로 나가면 막는다.
    await refused(save(env, plan, { startsOn: '2026-09-11' }), 409, 'INCOMES_OUTSIDE_PERIOD', '시작일')
    await refused(save(env, plan, { endsOn: '2027-02-19' }), 409, 'INCOMES_OUTSIDE_PERIOD', '끝일')
    assert.equal((await planOf(env, plan.period.id)).incomeRecords.find(income => income.id === used.id)?.receivedOn, '2026-09-10')
  } finally { await pg.close() }
})

test('결산서 자료: 이 기간의 수입과 3a 기준으로 센 지출을 기록 순으로 모으고, 증빙 링크와 취소 건수를 붙인다', async () => {
  const env = await setupPurchases()
  const { pg, db, ok, request, as } = env
  try {
    as('f')
    let plan = await createPeriod(env)
    plan = await ok<BudgetPlanResponse>(save(env, plan, { incomes: [{ id: null, name: '학생회비', amount: 800000 }],
      operating: [{ id: null, name: '회의비', amount: 100000 }], events: [{ eventId: 'e', version: 0, budget: 300000 }] }))
    await recordIncome(env, plan.period.id, { budgetLineId: plan.incomes[0]!.id, amount: 750000, receivedOn: '2026-09-05', note: '학교 지급' })
    const voidedIncome = await recordIncome(env, plan.period.id, { amount: 1000 })
    await ok(request('POST', `/budget/periods/${plan.period.id}/incomes/${voidedIncome.id}/void`, { version: 1, reason: '중복' }))
    // 행사 지출은 결제일이 기간 앞이어도 넣는다.
    const early = await record(env, { eventId: 'e', vendor: '쿠팡', amount: 50000, paidOn: '2026-08-28' })
    await record(env, { budgetLineId: plan.operating[0]!.id, amount: 12000, paidOn: '2026-10-01' })
    await record(env, { amount: 3000, paidOn: '2026-10-03', note: '물' })
    // 기간 밖 상시 운영 지출, 기간에 넣지 않은 행사의 지출, 취소한 지출은 넣지 않는다.
    await record(env, { amount: 4000, paidOn: '2026-08-31' })
    await record(env, { eventId: 'e2', amount: 6000 })
    const voided = await record(env, { amount: 9000 })
    await ok(request('POST', `/expenses/${voided.id}/void`, { version: 1, reason: '중복' }))
    await pg.exec(`INSERT INTO expense_receipts (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
      VALUES ('r1','a','${early.id}','receipts/a/${early.id}/r1','영수증.jpg','image/jpeg',1234,'receipt','ready','f',now()),
        ('r2','a','${early.id}','receipts/a/${early.id}/r2','올리는 중.jpg','image/jpeg',1234,'receipt','pending','f',NULL)`)
    const data = await createBudgetService(db).exportData({ organizationId: 'a', userId: 'n' }, plan.period.id, 'https://vada.test')
    assert.deepEqual([data.organizationName, data.period, data.voided], ['A', { name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' },
      { incomes: 1, expenses: 1 }])
    assert.deepEqual(data.incomes, [{ receivedOn: '2026-09-05', line: '학생회비', description: '학생회비 입금', amount: 750000, note: '학교 지급',
      recordedBy: '재정' }])
    assert.deepEqual(data.expenses.map(expense => [expense.paidOn, expense.line, expense.vendor, expense.amount, expense.note]),
      [['2026-08-28', '체육대회', '쿠팡', 50000, null], ['2026-10-01', '상시 운영 · 회의비', '다이소', 12000, null], ['2026-10-03', '상시 운영', '다이소', 3000, '물']])
    assert.deepEqual({ ...data.expenses[1]!, receipts: [] }, { paidOn: '2026-10-01', line: '상시 운영 · 회의비', vendor: '다이소', description: '회의 다과',
      amount: 12000, method: 'council_card', payer: '재정', note: null, recordedBy: '재정', receipts: [] })
    assert.deepEqual(data.expenses[0]!.receipts.map(receipt => [receipt.kind, receipt.fileName, receipt.uploadedBy, receipt.url]),
      [['receipt', '영수증.jpg', '재정', `https://vada.test/api/organizations/a/expenses/${early.id}/receipts/r1/file`]])
    assert.deepEqual([data.totals.received, data.totals.spent, data.totals.balance], [750000, 65000, 685000])
    assert.deepEqual(data.eventLines.map(line => [line.name, line.budget, line.spent]), [['체육대회', 300000, 50000]])
    assert.deepEqual([data.incomeLines, data.operatingLines.map(line => [line.name, line.spent]), data.unassigned],
      [[{ name: '학생회비', amount: 800000, received: 750000 }], [['회의비', 12000]], { spent: 3000, count: 1 }])
  } finally { await pg.close() }
})

test('결산서 내려받기: 구성원 누구나 받고 파일 이름은 기간 이름과 한국 날짜다. 다른 학생회·미인증·상한 초과는 거절한다', async () => {
  const env = await setupPurchases()
  const { pg, request, as } = env
  try {
    as('f')
    const plan = await createPeriod(env, { name: '2026/2학기' })
    const path = `/budget/periods/${plan.period.id}/export`
    as('n')
    const response = await request('GET', path)
    assert.equal(response.status, 200)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    assert.deepEqual([response.headers.get('Content-Type'), response.headers.get('Content-Disposition'), response.headers.get('Cache-Control')],
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent(`2026_2학기 결산 ${today}.xlsx`)}`, 'no-store'])
    assert.deepEqual(readBook(Buffer.from(await response.arrayBuffer())).names, ['요약', '수입 결산', '지출 결산', '수입·지출 내역', '증빙'])
    as('x')
    assert.equal((await request('GET', path)).status, 403)
    as(null)
    assert.equal((await request('GET', path)).status, 401)
    as('n')
    await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('pb','b','B 기간','2026-09-01','2027-02-28','x')`)
    for (const id of ['pb', 'missing']) assert.equal((await request('GET', `/budget/periods/${id}/export`)).status, 404, id)
    await pg.exec(`INSERT INTO expenses (id,organization_id,event_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
      SELECT 'bulk-' || n, 'a', NULL, '가게', '다과', 1000, DATE '2026-10-01', 'cash', 'f', 'f' FROM generate_series(1, 1001) AS n`)
    await refused(request('GET', path), 409, 'EXPORT_TOO_LARGE', '지출 상한')
    await pg.exec(`DELETE FROM expenses WHERE id LIKE 'bulk-%'`)
    await pg.exec(`INSERT INTO incomes (id,organization_id,period_id,description,amount,received_on,recorded_by)
      SELECT 'bulk-' || n, 'a', '${plan.period.id}', '입금', 1000, DATE '2026-10-01', 'f' FROM generate_series(1, 1001) AS n`)
    await refused(request('GET', path), 409, 'EXPORT_TOO_LARGE', '수입 상한')
  } finally { await pg.close() }
})
