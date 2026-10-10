import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPlanResponse, IncomeResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
// 2026년 2학기(수입 줄 학생회비·지원금, 운영 줄 회의비)와 2027년 1학기(수입 줄 학생회비)를 재정(f)이 만든다.
async function periods(env: Env) {
  env.as('f')
  const create = (name: string, startsOn: string, endsOn: string) =>
    env.ok<BudgetPlanResponse>(env.request('POST', '/budget/periods', { name, startsOn, endsOn }), 201)
  const plan = (created: BudgetPlanResponse, incomes: string[], operating: string[]) => env.ok<BudgetPlanResponse>(env.request('POST',
    `/budget/periods/${created.period.id}/plan`, { version: 1, name: created.period.name, startsOn: created.period.startsOn, endsOn: created.period.endsOn,
      incomes: incomes.map(name => ({ id: null, name, amount: 100000 })), operating: operating.map(name => ({ id: null, name, amount: 100000 })), events: [] }))
  const autumn = await plan(await create('2026년 2학기', '2026-09-01', '2027-02-28'), ['학생회비', '지원금'], ['회의비'])
  const spring = await plan(await create('2027년 1학기', '2027-03-01', '2027-08-31'), ['학생회비'], [])
  return { autumn, spring }
}
const incomeBody = (overrides: Record<string, unknown> = {}) => ({ description: '2학기 학생회비', amount: 750000, receivedOn: '2026-09-15',
  budgetLineId: null, note: null, ...overrides })

test('수입 기록: 재정 권한자만 기록하고, 받은 날은 기간 안이며, 그 기간의 수입 줄만 고른다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    const { autumn, spring } = await periods(env)
    const path = `/budget/periods/${autumn.period.id}/incomes`
    const [fees] = autumn.incomes
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await request('POST', path, incomeBody())).status, 403, user)
    }
    as(null)
    assert.equal((await request('POST', path, incomeBody())).status, 401)
    as('l')
    const { income } = await ok<IncomeResponse>(request('POST', path, incomeBody({ budgetLineId: fees!.id, note: '학교 지급' })), 201)
    assert.deepEqual({ ...income, id: '', createdAt: '', updatedAt: '', history: [] }, { id: '', budgetLine: { id: fees!.id, name: '학생회비' },
      description: '2학기 학생회비', amount: 750000, receivedOn: '2026-09-15', note: '학교 지급', recordedBy: { id: 'l', name: '회장' }, voided: null,
      carriedFrom: null, version: 1, createdAt: '', updatedAt: '', history: [] })
    assert.deepEqual(income.history.map(entry => [entry.action, entry.actor.name, entry.changes]), [['created', '회장', {}]])
    // 항목 없이도 기록하고, 기간 첫날과 끝날도 받는다.
    for (const receivedOn of ['2026-09-01', '2027-02-28']) await ok(request('POST', path, incomeBody({ receivedOn })), 201)
    for (const receivedOn of ['2026-08-31', '2027-03-01']) await refused(request('POST', path, incomeBody({ receivedOn })), 409, 'DATE_OUTSIDE_PERIOD', receivedOn)
    // 다른 기간의 수입 줄, 운영 줄, 없는 줄, 다른 학생회의 줄은 고를 수 없다.
    await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('pb','b','B 기간','2026-09-01','2027-02-28','x');
      INSERT INTO budget_lines (id,organization_id,period_id,kind,name,amount,position) VALUES ('lb','b','pb','income','남의 수입',1,0)`)
    for (const budgetLineId of [spring.incomes[0]!.id, autumn.operating[0]!.id, 'missing', 'lb']) {
      await refused(request('POST', path, incomeBody({ budgetLineId })), 409, 'BUDGET_LINE_INVALID', budgetLineId)
    }
    // 다른 학생회의 기간이나 없는 기간에는 기록하지 않는다.
    for (const id of ['pb', 'missing']) await refused(request('POST', `/budget/periods/${id}/incomes`, incomeBody()), 404, 'NOT_FOUND', id)
    const { rows } = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM incomes')
    assert.equal(rows[0]!.count, 3)
  } finally { await pg.close() }
})

test('수입 본문이 틀리면 인증 전에 400으로 거절한다', async () => {
  const env = await setupPurchases()
  const { pg, request } = env
  try {
    const { autumn } = await periods(env)
    const path = `/budget/periods/${autumn.period.id}/incomes`
    const bodies = [{ ...incomeBody(), description: undefined }, incomeBody({ description: '   ' }), incomeBody({ description: '😀'.repeat(101) }),
      incomeBody({ note: `메모${String.fromCharCode(0)}` }), incomeBody({ description: `입금${String.fromCharCode(0xd800)}` }), incomeBody({ amount: 0 }),
      { ...incomeBody(), budgetLineId: undefined }, { ...incomeBody(), extra: 1 }]
    for (const body of bodies) await refused(request('POST', path, body), 400, 'INVALID_INPUT', JSON.stringify(body).slice(0, 60))
  } finally { await pg.close() }
})

test('수입 수정: 모든 칸을 다시 받아 바뀐 칸만 기록하고, 버전·기간·경로를 지킨다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    const { autumn, spring } = await periods(env)
    const path = `/budget/periods/${autumn.period.id}/incomes`
    const [fees, grant] = autumn.incomes
    const { income } = await ok<IncomeResponse>(request('POST', path, incomeBody({ budgetLineId: fees!.id })), 201)
    // 바뀐 것이 없으면 버전과 기록을 그대로 둔다.
    const same = await ok<IncomeResponse>(request('PATCH', `${path}/${income.id}`, { version: 1, ...incomeBody({ budgetLineId: fees!.id }) }))
    assert.deepEqual([same.income.version, same.income.history.length], [1, 1])
    const { income: changed } = await ok<IncomeResponse>(request('PATCH', `${path}/${income.id}`, { version: 1, ...incomeBody({ description: '학교 지원금',
      amount: 200000, receivedOn: '2026-10-01', budgetLineId: grant!.id, note: '1차' }) }))
    assert.deepEqual([changed.version, changed.budgetLine, changed.history.at(-1)!.action], [2, { id: grant!.id, name: '지원금' }, 'updated'])
    assert.deepEqual(changed.history.at(-1)!.changes, { description: { from: '2학기 학생회비', to: '학교 지원금' }, amount: { from: 750000, to: 200000 },
      receivedOn: { from: '2026-09-15', to: '2026-10-01' }, note: { from: null, to: '1차' }, budgetLine: { from: '학생회비', to: '지원금' } })
    const { income: cleared } = await ok<IncomeResponse>(request('PATCH', `${path}/${income.id}`, { version: 2, ...incomeBody({ description: '학교 지원금',
      amount: 200000, receivedOn: '2026-10-01', note: '1차' }) }))
    assert.deepEqual([cleared.budgetLine, cleared.history.at(-1)!.changes], [null, { budgetLine: { from: '지원금', to: null } }])
    await refused(request('PATCH', `${path}/${income.id}`, { version: 2, ...incomeBody() }), 409, 'VERSION_CONFLICT')
    await refused(request('PATCH', `${path}/${income.id}`, { version: 3, ...incomeBody({ receivedOn: '2027-03-02' }) }), 409, 'DATE_OUTSIDE_PERIOD')
    await refused(request('PATCH', `${path}/${income.id}`, { version: 3, ...incomeBody({ budgetLineId: spring.incomes[0]!.id }) }), 409, 'BUDGET_LINE_INVALID')
    // 다른 기간 경로로는 찾을 수 없다. 옮기려면 취소하고 그 기간에서 다시 기록한다.
    await refused(request('PATCH', `/budget/periods/${spring.period.id}/incomes/${income.id}`, { version: 3, ...incomeBody({ receivedOn: '2027-03-02' }) }),
      404, 'NOT_FOUND')
    await refused(request('GET', `/budget/periods/${spring.period.id}/incomes/${income.id}`), 404, 'NOT_FOUND')
    for (const id of ['missing', 'x'.repeat(65)]) assert.equal((await request('GET', `${path}/${id}`)).status, 404, id)
  } finally { await pg.close() }
})

test('수입 취소: 사유를 남기고 다시 고치거나 취소할 수 없다. 구성원 누구나 상세를 보고, 재정 권한자만 고친다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    const { autumn } = await periods(env)
    const path = `/budget/periods/${autumn.period.id}/incomes`
    const { income } = await ok<IncomeResponse>(request('POST', path, incomeBody()), 201)
    for (const user of ['p', 'n']) {
      as(user)
      assert.equal((await request('POST', `${path}/${income.id}/void`, { version: 1, reason: '중복' })).status, 403, user)
      assert.equal((await request('PATCH', `${path}/${income.id}`, { version: 1, ...incomeBody() })).status, 403, user)
    }
    as('f')
    const { income: voided } = await ok<IncomeResponse>(request('POST', `${path}/${income.id}/void`, { version: 1, reason: '중복 입금' }))
    assert.deepEqual([voided.version, voided.voided?.by.name, voided.voided?.reason], [2, '재정', '중복 입금'])
    assert.deepEqual(voided.history.map(entry => [entry.action, entry.changes]), [['created', {}], ['voided', { reason: '중복 입금' }]])
    await refused(request('POST', `${path}/${income.id}/void`, { version: 2, reason: '또' }), 409, 'INVALID_STATE')
    await refused(request('PATCH', `${path}/${income.id}`, { version: 2, ...incomeBody() }), 409, 'INVALID_STATE')
    await refused(request('POST', `${path}/${income.id}/void`, { version: 1, reason: '또' }), 409, 'VERSION_CONFLICT')
    as('n')
    const seen = await ok<IncomeResponse>(request('GET', `${path}/${income.id}`))
    assert.equal(seen.income.voided?.reason, '중복 입금')
    // 다른 학생회 사용자와 미인증은 보기·수정·취소 모두 막는다.
    const calls = [() => request('GET', `${path}/${income.id}`), () => request('PATCH', `${path}/${income.id}`, { version: 2, ...incomeBody() }),
      () => request('POST', `${path}/${income.id}/void`, { version: 2, reason: '또' })]
    for (const [user, status] of [['x', 403], [null, 401]] as const) {
      as(user)
      for (const call of calls) assert.equal((await call()).status, status, `${user}`)
    }
  } finally { await pg.close() }
})
