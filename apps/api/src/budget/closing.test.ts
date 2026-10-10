import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPeriodsResponse, BudgetPlanResponse, EventFinanceResponse, ExpenseResponse, IncomeResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'
import { readBook } from '../workbook/read-book.js'

// 마감 조건이 오늘(한국 날짜)에 기대므로, 기간은 확실히 지난 날짜나 먼 미래로 만든다.
type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
const create = (env: Env, name: string, startsOn: string, endsOn: string) =>
  env.ok<BudgetPlanResponse>(env.request('POST', '/budget/periods', { name, startsOn, endsOn }), 201)
const planOf = (env: Env, periodId: string) => env.ok<BudgetPlanResponse>(env.request('GET', `/budget/periods/${periodId}`))
// 받은 편성을 그대로 다시 보내는 본문. 행사 예산은 보내지 않아 그대로 둔다. 바꿀 칸만 덮어쓴다.
const planBody = (plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) => ({ version: plan.period.version, name: plan.period.name,
  startsOn: plan.period.startsOn, endsOn: plan.period.endsOn, incomes: plan.incomes.map(({ id, name, amount }) => ({ id, name, amount })),
  operating: plan.operating.map(({ id, name, amount }) => ({ id, name, amount })),
  events: plan.events.map(({ eventId, version }) => ({ eventId, version })), ...overrides })
const save = (env: Env, plan: BudgetPlanResponse, overrides: Record<string, unknown> = {}) =>
  env.request('POST', `/budget/periods/${plan.period.id}/plan`, planBody(plan, overrides))
const close = (env: Env, plan: BudgetPlanResponse, carryoverLineId: string | null = null) =>
  env.request('POST', `/budget/periods/${plan.period.id}/close`, { version: plan.period.version, carryoverLineId })
const reopen = (env: Env, plan: BudgetPlanResponse, reason = '영수증 빠짐') =>
  env.request('POST', `/budget/periods/${plan.period.id}/reopen`, { version: plan.period.version, reason })
const recordIncome = async (env: Env, periodId: string, overrides: Record<string, unknown>) => (await env.ok<IncomeResponse>(env.request('POST',
  `/budget/periods/${periodId}/incomes`, { description: '학생회비', amount: 100000, budgetLineId: null, note: null, ...overrides }), 201)).income
// 지출 기록 본문. 기본은 2025-10-01의 상시 운영 지출이다.
const recordExpense = async (env: Env, overrides: Record<string, unknown> = {}) => (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', {
  eventId: null, vendor: '다이소', description: '회의 다과', amount: 12000, paidOn: '2025-10-01', method: 'council_card', payerMembershipId: 'mf',
  note: null, itemIds: [], budgetLineId: null, ...overrides }), 201)).expense
// 확인된 영수증 한 장을 붙인다(올리기 흐름은 영수증 테스트가 본다).
const attachReceipt = (env: Env, expenseId: string, id = `r-${expenseId}`) => env.pg.exec(`INSERT INTO expense_receipts
  (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
  VALUES ('${id}','a','${expenseId}','receipts/a/${expenseId}/${id}','영수증.jpg','image/jpeg',1234,'receipt','ready','f',now())`)

test('마감: 조건이 하나라도 안 맞으면 막고, 맞으면 잠그며 남은 돈을 다음 기간 시작일의 수입으로 넘긴다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    let autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    let spring = await create(env, '2026년 1학기', '2026-03-01', '2026-08-31')
    spring = await ok<BudgetPlanResponse>(save(env, spring, { incomes: [{ id: null, name: '학생회비', amount: 500000 },
      { id: null, name: '전기 이월금', amount: 50000 }] }))
    const carriedLine = spring.incomes[1]!
    // 끝나지 않은 기간은 마감하지 않는다.
    const far = await create(env, '먼 기간', '2999-01-01', '2999-12-31')
    assert.equal(far.closing.ended, false)
    await refused(close(env, far), 409, 'NOT_READY_TO_CLOSE', '끝나지 않음')
    // 앞 기간이 열려 있으면 마감하지 않는다.
    assert.deepEqual(spring.closing.earlierOpen, { id: autumn.period.id, name: '2025년 2학기' })
    await refused(close(env, spring), 409, 'NOT_READY_TO_CLOSE', '앞 기간 열림')
    // 증빙이 없는 상시 운영 지출이 있고 남은 돈이 음수다.
    const snack = await recordExpense(env)
    autumn = await planOf(env, autumn.period.id)
    assert.deepEqual([autumn.closing.missingEvidence, autumn.totals.balance], [1, -12000])
    await refused(close(env, autumn), 409, 'NOT_READY_TO_CLOSE', '증빙·음수')
    await recordIncome(env, autumn.period.id, { receivedOn: '2025-09-15' })
    await refused(close(env, await planOf(env, autumn.period.id)), 409, 'NOT_READY_TO_CLOSE', '증빙')
    await attachReceipt(env, snack.id)
    // 넣은 행사가 정산 전이면 마감하지 않는다.
    autumn = await ok<BudgetPlanResponse>(save(env, await planOf(env, autumn.period.id), { events: [{ eventId: 'e', version: 0 }] }))
    await refused(close(env, autumn), 409, 'NOT_READY_TO_CLOSE', '정산 전 행사')
    await ok(request('POST', '/events/e/finance/settle', { version: 0 }))
    autumn = await planOf(env, autumn.period.id)
    assert.deepEqual(autumn.closing, { ended: true, earlierOpen: null, missingEvidence: 0, carriedOver: null,
      next: { id: spring.period.id, name: '2026년 1학기', startsOn: '2026-03-01', closed: false, incomes: spring.incomes.map(({ id, name }) => ({ id, name })) } })
    assert.equal(autumn.period.closed, null)

    const closed = await ok<BudgetPlanResponse>(close(env, autumn, carriedLine.id))
    assert.deepEqual([closed.period.version, closed.period.closed?.by, closed.closing.carriedOver],
      [autumn.period.version + 1, { id: 'f', name: '재정' }, { period: { id: spring.period.id, name: '2026년 1학기' }, amount: 88000 }])
    const last = closed.history.at(-1)!
    assert.deepEqual([last.action, last.actor.name, last.changes, last.reason], ['closed', '재정', { received: 100000, spent: 12000, balance: 88000,
      carryover: { period: '2026년 1학기', amount: 88000, line: '전기 이월금' } }, null])
    // 이월금은 다음 기간 시작일의 수입 한 건이다.
    spring = await planOf(env, spring.period.id)
    const carried = spring.incomeRecords.find(income => income.carriedFrom !== null)!
    assert.deepEqual([carried.description, carried.amount, carried.receivedOn, carried.budgetLine, carried.carriedFrom, carried.recordedBy.name, carried.note],
      ['2025년 2학기 이월금', 88000, '2026-03-01', { id: carriedLine.id, name: '전기 이월금' }, { id: autumn.period.id, name: '2025년 2학기' }, '재정', null])
    assert.deepEqual([spring.incomes[1]!.received, spring.totals.received, spring.totals.balance], [88000, 88000, 88000])
    // 옛 버전으로 다시 마감하면 버전이 틀리고, 새 버전으로도 이미 마감했다.
    await refused(close(env, autumn), 409, 'VERSION_CONFLICT')
    await refused(close(env, closed), 409, 'INVALID_STATE')
    const { periods } = await ok<BudgetPeriodsResponse>(request('GET', '/budget/periods'))
    assert.deepEqual(periods.map(period => [period.name, period.closed]), [['먼 기간', false], ['2026년 1학기', false], ['2025년 2학기', true]])
  } finally { await pg.close() }
})

test('마감: 남은 돈이 있으면 다음 기간이 있어야 하고, 0원이면 다음 기간이 없거나 있어도 이월금 없이 마감한다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    let autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    const fee = await recordIncome(env, autumn.period.id, { amount: 50000, receivedOn: '2025-09-15' })
    autumn = await planOf(env, autumn.period.id)
    assert.deepEqual([autumn.totals.balance, autumn.closing.next], [50000, null])
    await refused(close(env, autumn), 409, 'NOT_READY_TO_CLOSE')
    await ok(request('POST', `/budget/periods/${autumn.period.id}/incomes/${fee.id}/void`, { version: 1, reason: '중복' }))
    // 남은 돈이 0원이면 넘길 곳이 없어도 마감하고, 보낸 수입 항목은 보지 않는다.
    const closed = await ok<BudgetPlanResponse>(close(env, await planOf(env, autumn.period.id), 'ignored'))
    assert.deepEqual([closed.closing.carriedOver, closed.history.at(-1)!.changes], [null, { received: 0, spent: 0, balance: 0, carryover: null }])
    // 다음 기간이 있어도 남은 돈이 0원이면 이월금을 만들지 않는다.
    const spring = await create(env, '2026년 1학기', '2026-03-01', '2026-08-31')
    const winter = await create(env, '2026년 2학기', '2026-09-01', '2027-02-28')
    await ok(close(env, spring))
    assert.deepEqual([(await planOf(env, autumn.period.id)).closing.carriedOver, (await planOf(env, spring.period.id)).incomeRecords,
      (await planOf(env, winter.period.id)).incomeRecords], [null, [], []])
  } finally { await pg.close() }
})

test('이월금: 다음 기간의 수입 줄만 고르고, 손으로 고치거나 취소할 수 없으며, 수입 줄·날짜 규칙을 그대로 따른다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    let autumn = await ok<BudgetPlanResponse>(save(env, await create(env, '2025년 2학기', '2025-09-01', '2026-02-28'),
      { incomes: [{ id: null, name: '학생회비', amount: 30000 }] }))
    let spring = await ok<BudgetPlanResponse>(save(env, await create(env, '2026년 1학기', '2026-03-01', '2026-08-31'),
      { incomes: [{ id: null, name: '이월금', amount: 0 }], operating: [{ id: null, name: '회의비', amount: 0 }] }))
    await recordIncome(env, autumn.period.id, { amount: 30000, receivedOn: '2025-09-15', budgetLineId: autumn.incomes[0]!.id })
    autumn = await planOf(env, autumn.period.id)
    for (const lineId of [spring.operating[0]!.id, autumn.incomes[0]!.id, 'missing']) {
      await refused(close(env, autumn, lineId), 409, 'BUDGET_LINE_INVALID', lineId)
    }
    // 실패한 마감은 아무것도 남기지 않는다.
    assert.deepEqual([(await planOf(env, autumn.period.id)).period.closed, (await planOf(env, spring.period.id)).incomeRecords], [null, []])
    await ok(close(env, autumn, spring.incomes[0]!.id))
    spring = await planOf(env, spring.period.id)
    const carried = spring.incomeRecords[0]!
    const path = `/budget/periods/${spring.period.id}/incomes/${carried.id}`
    await refused(request('PATCH', path, { version: 1, description: '고침', amount: 1, receivedOn: '2026-03-01', budgetLineId: null, note: null }),
      409, 'CARRYOVER_INCOME')
    await refused(request('POST', `${path}/void`, { version: 1, reason: '고침' }), 409, 'CARRYOVER_INCOME')
    // 이월금이 고른 수입 줄은 지울 수 없고, 이월금이 기간 밖으로 나가는 날짜 변경도 막는다.
    await refused(save(env, spring, { incomes: [] }), 409, 'LINE_IN_USE')
    await refused(save(env, spring, { startsOn: '2026-03-02' }), 409, 'INCOMES_OUTSIDE_PERIOD')
  } finally { await pg.close() }
})

test('다시 열기: 재정 권한자만 사유를 남겨 열고, 다음 기간이 마감돼 있으면 막으며, 이월금을 취소하고 다시 마감하면 새로 넘긴다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    let autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    let spring = await create(env, '2026년 1학기', '2026-03-01', '2026-08-31')
    await recordIncome(env, autumn.period.id, { amount: 88000, receivedOn: '2025-09-15' })
    autumn = await ok<BudgetPlanResponse>(close(env, await planOf(env, autumn.period.id)))
    for (const [user, status] of [['p', 403], ['n', 403], ['x', 403], [null, 401]] as const) {
      as(user)
      assert.equal((await reopen(env, autumn)).status, status, `${user} reopen`)
      assert.equal((await close(env, spring)).status, status, `${user} close`)
    }
    as('l')
    // 다음 기간을 마감하면 앞 기간은 다시 열 수 없다. 줄을 고르지 않은 이월금은 항목 없는 수입이다.
    const winter = await create(env, '2026년 2학기', '2026-09-01', '2027-02-28')
    spring = await ok<BudgetPlanResponse>(close(env, await planOf(env, spring.period.id)))
    assert.deepEqual((await planOf(env, winter.period.id)).incomeRecords.map(income => [income.description, income.amount, income.budgetLine]),
      [['2026년 1학기 이월금', 88000, null]])
    autumn = await planOf(env, autumn.period.id)
    assert.equal(autumn.closing.next?.closed, true)
    await refused(reopen(env, autumn), 409, 'LATER_PERIOD_CLOSED')
    // 뒤 기간부터 다시 연다. 넘긴 이월금은 사유와 함께 취소된다.
    spring = await ok<BudgetPlanResponse>(reopen(env, spring, '결산 정정'))
    const last = spring.history.at(-1)!
    assert.deepEqual([spring.period.closed, spring.closing.carriedOver, last.action, last.actor.name, last.reason, last.changes],
      [null, null, 'reopened', '회장', '결산 정정', {}])
    const voided = (await planOf(env, winter.period.id)).incomeRecords[0]!
    assert.deepEqual([voided.voided?.reason, voided.voided?.by.name], ['2026년 1학기 마감을 다시 열었어요', '회장'])
    const { income } = await ok<IncomeResponse>(request('GET', `/budget/periods/${winter.period.id}/incomes/${voided.id}`))
    assert.deepEqual(income.history.map(entry => [entry.action, entry.changes]), [['created', {}], ['voided', { reason: '2026년 1학기 마감을 다시 열었어요' }]])
    // 앞 기간을 다시 열고 수입을 더해 다시 마감하면 새 금액으로 한 건만 넘긴다.
    autumn = await ok<BudgetPlanResponse>(reopen(env, autumn))
    await recordIncome(env, autumn.period.id, { amount: 12000, receivedOn: '2025-10-01' })
    await ok(close(env, await planOf(env, autumn.period.id)))
    const fromAutumn = (await planOf(env, spring.period.id)).incomeRecords.filter(entry => entry.carriedFrom?.id === autumn.period.id)
    assert.deepEqual(fromAutumn.map(entry => [entry.amount, entry.voided !== null]).sort(), [[100000, false], [88000, true]])
    // 열린 기간은 다시 열지 않는다.
    await refused(reopen(env, await planOf(env, spring.period.id)), 409, 'INVALID_STATE')
  } finally { await pg.close() }
})

test('마감: 끝일 당일(한국 날짜)에는 할 수 없고 다음 날부터 된다', async () => {
  const env = await setupPurchases()
  const { pg, ok, as } = env
  try {
    as('f')
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    const period = await create(env, '오늘 끝나는 기간', '2020-01-01', today)
    assert.equal(period.closing.ended, false)
    await refused(close(env, period), 409, 'NOT_READY_TO_CLOSE')
    const moved = await ok<BudgetPlanResponse>(save(env, period, { endsOn: yesterday }))
    assert.equal(moved.closing.ended, true)
    await ok(close(env, moved))
  } finally { await pg.close() }
})

test('마감·다시 열기: 본문이 틀리면 400이고, 다른 학생회 기간과 틀린 ID는 404다', async () => {
  const env = await setupPurchases()
  const { pg, request, as } = env
  try {
    as('f')
    const autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    const base = `/budget/periods/${autumn.period.id}`
    for (const body of [{ version: 0, carryoverLineId: null }, { version: 1 }, { version: 1, carryoverLineId: null, extra: 1 }]) {
      await refused(request('POST', `${base}/close`, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    for (const reason of ['   ', '😀'.repeat(201), `사유${String.fromCharCode(0)}`, `사유${String.fromCharCode(0xd800)}`]) {
      await refused(request('POST', `${base}/reopen`, { version: 1, reason }), 400, 'INVALID_INPUT', reason.slice(0, 10))
    }
    await pg.exec(`INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('pb','b','B 기간','2025-09-01','2026-02-28','x')`)
    for (const id of ['pb', 'missing', 'x'.repeat(65)]) {
      await refused(request('POST', `/budget/periods/${id}/close`, { version: 1, carryoverLineId: null }), 404, 'NOT_FOUND', id)
      await refused(request('POST', `/budget/periods/${id}/reopen`, { version: 1, reason: '사유' }), 404, 'NOT_FOUND', id)
    }
  } finally { await pg.close() }
})

// 지출 수정 본문. 받은 지출을 그대로 다시 보내고 바꿀 칸만 덮어쓴다.
const expenseEdit = (expense: ExpenseResponse['expense'], overrides: Record<string, unknown> = {}) => ({ version: expense.version,
  eventId: expense.event?.id ?? null, vendor: expense.vendor, description: expense.description, amount: expense.amount, paidOn: expense.paidOn,
  method: expense.method, payerMembershipId: 'mf', note: expense.note, itemIds: [], budgetLineId: null, ...overrides })

test('마감한 기간: 편성·수입·상시 운영 지출·증빙 삭제·행사 정산 다시 열기를 막고, 증빙 추가와 다른 기간·행사의 지출은 둔다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    let autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    await create(env, '2026년 1학기', '2026-03-01', '2026-08-31')
    const fee = await recordIncome(env, autumn.period.id, { receivedOn: '2025-09-15' })
    const snack = await recordExpense(env)
    await attachReceipt(env, snack.id, 'r1')
    const later = await recordExpense(env, { paidOn: '2026-03-05' })
    autumn = await ok<BudgetPlanResponse>(save(env, await planOf(env, autumn.period.id), { events: [{ eventId: 'e', version: 0 }] }))
    await ok(request('POST', '/events/e/finance/settle', { version: 0 }))
    autumn = await ok<BudgetPlanResponse>(close(env, await planOf(env, autumn.period.id)))
    const incomes = `/budget/periods/${autumn.period.id}/incomes`
    const blocked: [string, () => Response | Promise<Response>][] = [
      ['편성 저장', () => save(env, autumn)],
      ['수입 기록', () => request('POST', incomes, { description: '후원', amount: 1000, receivedOn: '2025-10-02', budgetLineId: null, note: null })],
      ['수입 수정', () => request('PATCH', `${incomes}/${fee.id}`, { version: 1, description: '고침', amount: 1000, receivedOn: '2025-10-02',
        budgetLineId: null, note: null })],
      ['수입 취소', () => request('POST', `${incomes}/${fee.id}/void`, { version: 1, reason: '중복' })],
      ['지출 기록', () => request('POST', '/expenses', { ...expenseEdit(snack, { paidOn: '2025-11-01' }), version: undefined })],
      ['지출 수정', () => request('PATCH', `/expenses/${snack.id}`, expenseEdit(snack, { description: '고침' }))],
      ['지출 취소', () => request('POST', `/expenses/${snack.id}/void`, { version: snack.version, reason: '중복' })],
      ['증빙 삭제', () => request('POST', `/expenses/${snack.id}/receipts/r1/delete`, {})],
      ['마감한 기간으로 옮김', () => request('PATCH', `/expenses/${later.id}`, expenseEdit(later, { paidOn: '2025-12-01' }))],
      ['행사 지출로 바꿈', () => request('PATCH', `/expenses/${snack.id}`, expenseEdit(snack, { eventId: 'e2' }))],
      ['정산 다시 열기', () => request('POST', '/events/e/finance/reopen', { version: 1, reason: '빠짐' })],
    ]
    for (const [label, call] of blocked) await refused(call(), 409, 'PERIOD_CLOSED', label)
    // 증빙 추가, 열린 기간의 상시 운영 지출, 어느 기간에도 없는 행사의 지출은 결제일이 마감한 기간 안이어도 된다.
    assert.equal((await request('POST', `/expenses/${snack.id}/receipts`, { fileName: '영수증 2.jpg', contentType: 'image/jpeg', size: 1234,
      kind: 'receipt' })).status, 201)
    await recordExpense(env, { paidOn: '2026-03-02' })
    const festival = await recordExpense(env, { eventId: 'e2', paidOn: '2025-10-15' })
    const closedOf = async (id: string) => (await ok<ExpenseResponse>(request('GET', `/expenses/${id}`))).expense.periodClosed
    assert.deepEqual([await closedOf(snack.id), await closedOf(later.id), await closedOf(festival.id)], [true, false, false])
    const financeOf = async (eventId: string) => (await ok<EventFinanceResponse>(request('GET', `/events/${eventId}/finance`))).finance.periodClosed
    assert.deepEqual([await financeOf('e'), await financeOf('e2')], [true, false])
    // 다시 열면 바꿀 수 있다.
    await ok(reopen(env, autumn))
    await ok(request('PATCH', `/expenses/${snack.id}`, expenseEdit(snack, { description: '고침' })))
    await ok(request('POST', '/events/e/finance/reopen', { version: 1, reason: '빠짐' }))
    assert.equal(await closedOf(snack.id), false)
  } finally { await pg.close() }
})

test('기간 순서: 마감한 기간과 이월금을 받은 기간보다 앞서는 기간은 만들거나 옮길 수 없다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    const autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    const winter = await create(env, '2026년 2학기', '2026-09-01', '2027-02-28')
    await recordIncome(env, autumn.period.id, { amount: 1000, receivedOn: '2025-09-15' })
    const closed = await ok<BudgetPlanResponse>(close(env, await planOf(env, autumn.period.id)))
    // 마감한 기간 앞이나, 마감한 기간과 이월금을 받은 기간 사이에는 두지 않는다.
    for (const [name, startsOn, endsOn] of [['2025년 1학기', '2025-03-01', '2025-08-31'], ['2026년 1학기', '2026-03-01', '2026-08-31']]) {
      await refused(request('POST', '/budget/periods', { name, startsOn, endsOn }), 409, 'PERIOD_BEFORE_CLOSED', name)
    }
    const spring27 = await create(env, '2027년 1학기', '2027-03-01', '2027-08-31')
    await refused(save(env, spring27, { startsOn: '2026-03-01', endsOn: '2026-08-31' }), 409, 'PERIOD_BEFORE_CLOSED', '옮김')
    // 이월금을 받은 기간 자신은 시작일을 당길 수 있다.
    await ok(save(env, await planOf(env, winter.period.id), { startsOn: '2026-08-01' }))
    // 다시 열면 사이에 기간을 둘 수 있다.
    await ok(reopen(env, closed))
    await create(env, '2026년 1학기', '2026-03-01', '2026-07-31')
  } finally { await pg.close() }
})

test('결산서: 마감한 기간은 마감한 때·사람과 다음 기간으로 넘긴 돈을 요약에 적는다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    const autumn = await create(env, '2025년 2학기', '2025-09-01', '2026-02-28')
    await create(env, '2026년 1학기', '2026-03-01', '2026-08-31')
    await recordIncome(env, autumn.period.id, { amount: 88000, receivedOn: '2025-09-15' })
    const summaryOf = async () => {
      const response = await request('GET', `/budget/periods/${autumn.period.id}/export`)
      assert.equal(response.status, 200)
      const rows = readBook(Buffer.from(await response.arrayBuffer())).rows(0)
      return (label: string) => rows.find(cells => cells[0] === label)?.slice(1)
    }
    let row = await summaryOf()
    assert.deepEqual([row('마감'), row('다음 기간으로 넘긴 돈')], [['마감 전'], undefined])
    await ok(close(env, await planOf(env, autumn.period.id)))
    row = await summaryOf()
    assert.match(row('마감')![0]!, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} 재정$/)
    assert.deepEqual(row('다음 기간으로 넘긴 돈'), ['88000', '2026년 1학기'])
  } finally { await pg.close() }
})
