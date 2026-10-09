import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPeriodsResponse, BudgetPlanResponse, ExpenseResponse } from '@vada/contracts'
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
    assert.deepEqual(autumn.period, { id: autumn.period.id, name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28', version: 1 })
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
    assert.deepEqual(plan.incomes, [{ id: 'li', name: '학생회비', amount: 800000 }])
    // 가짜 생성기의 승인 품목은 수량 2, 예상 단가 11,590원이다.
    assert.deepEqual(plan.events, [{ eventId: 'e', name: '체육대회', budget: 300000, spent: 57000, planned: 23180, plannedUnknown: 0,
      remaining: 219820, settled: false, version: 1 }])
    assert.deepEqual(plan.operating, [{ id: 'lo1', name: '회의비', amount: 100000, spent: 12000, remaining: 88000, expenseCount: 1 },
      { id: 'lo2', name: '소모품', amount: 50000, spent: 0, remaining: 50000, expenseCount: 0 }])
    assert.deepEqual(plan.unassigned, { spent: 3000, count: 1 })
    assert.deepEqual(plan.totals, { income: 800000, budget: 450000, undecided: 0, spent: 72000, planned: 23180, plannedUnknown: 0,
      remaining: 450000 - 72000 - 23180 })
    assert.deepEqual(plan.candidates, [{ eventId: 'e2', name: '축제', budget: null, version: 0, settled: false, spent: 6000 }])
    assert.deepEqual(plan.notices, { eventsWithSpending: 1, operatingOutside: 1 })
  } finally { await pg.close() }
})
